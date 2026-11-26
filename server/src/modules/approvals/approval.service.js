const repo = require('../risk-registers/riskRegister.repository');
const rrService = require('../risk-registers/riskRegister.service');
const ApiError = require('../../utils/ApiError');
const { withTransaction } = require('../../db/pool');
const { STATUS, MR_PENDING } = require('../../config/status');
const { audit } = require('../../middlewares/audit');
const { notify } = require('../../utils/notify');
const { query } = require('../../db/pool');
const { ROLES } = require('../../config/roles');

/** Antrian approval sesuai role pemanggil */
const getQueue = async (user, filters, pagination) => {
  const statusFilter = user.role === ROLES.MR ? MR_PENDING : STATUS.WAITING_OWNER_APPROVAL;
  return rrService.getList(
    { ...filters, status: statusFilter },
    { role: user.role, userId: user.id },
    pagination
  );
};

const getDetail = (id, user) => rrService.getDetail(id, user);

const assertApprovable = (header, user) => {
  if (user.role === ROLES.RISK_OWNER) {
    if (header.risk_owner_id !== user.id) {
      throw ApiError.forbidden('Risk Register ini bukan tanggung jawab Anda');
    }
    if (header.status !== STATUS.WAITING_OWNER_APPROVAL) {
      throw ApiError.conflict('Risk Register tidak dalam status menunggu approval Risk Owner', {
        current_status: header.status,
      });
    }
    return { newStatus: STATUS.WAITING_MR_INSTRUCTION, action: 'APPROVE_OWNER' };
  }

  if (user.role === ROLES.MR) {
    if (header.status !== STATUS.WAITING_MR_APPROVAL) {
      throw ApiError.conflict('Risk Register tidak dalam status menunggu approval MR', {
        current_status: header.status,
      });
    }
    return { newStatus: STATUS.APPROVED, action: 'APPROVE_MR' };
  }

  throw ApiError.forbidden('Role Anda tidak dapat melakukan approval');
};

const assertRejectable = (header, user) => {
  if (user.role === ROLES.RISK_OWNER) {
    if (header.risk_owner_id !== user.id) throw ApiError.forbidden('Risk Register ini bukan tanggung jawab Anda');
    if (header.status !== STATUS.WAITING_OWNER_APPROVAL) {
      throw ApiError.conflict('Risk Register tidak dalam status menunggu approval Risk Owner', {
        current_status: header.status,
      });
    }
    return { newStatus: STATUS.REJECTED_BY_OWNER, action: 'REJECT_OWNER' };
  }
  if (user.role === ROLES.MR) {
    if (header.status !== STATUS.WAITING_MR_APPROVAL) {
      throw ApiError.conflict('Risk Register tidak dalam status menunggu approval MR', {
        current_status: header.status,
      });
    }
    return { newStatus: STATUS.REJECTED_BY_MR, action: 'REJECT_MR' };
  }
  throw ApiError.forbidden('Role Anda tidak dapat melakukan reject');
};

const activeMrIds = async () => {
  const [rows] = await query(`SELECT id FROM users WHERE role = 'MR' AND status = 'ACTIVE'`);
  return rows.map((r) => r.id);
};

const updateMitigationRow = async (conn, registerId, version, fields) => {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  await conn.query(
    `UPDATE risk_mitigation_histories SET ${keys.map((k) => `\`${k}\` = ?`).join(', ')}
      WHERE risk_register_id = ? AND version = ?`,
    [...keys.map((k) => fields[k]), registerId, version]
  );
};

/** APPROVE — aman dari approve ganda (optimistic status guard) */
const approve = async (id, req) => {
  const user = req.user;
  const header = await repo.findHeader(id);
  if (!header) throw ApiError.notFound('Risk Register tidak ditemukan');

  let { newStatus, action } = assertApprovable(header, user);
  const assessments = req.body?.assessments;
  const mrNotes = assessments ? assessments.map((a) => String(a.note || '').trim()).join(' | ') : null;

  if (user.role === ROLES.MR) {
    if (assessments) {
      const errors = rrService.validateFinalAssessments(assessments);
      if (errors.length) throw ApiError.badRequest('Penilaian akhir MR tidak valid', errors);
    } else {
      await rrService.assertFollowUpStatusesComplete(id);
    }
    newStatus = await rrService.resolveMrFinalStatus(id, assessments);
    action = newStatus === STATUS.APPROVED ? 'APPROVE_MR' : 'MR_FINAL_RETURN';
  }

  const isFinal = newStatus === STATUS.APPROVED;
  const isReturn = newStatus === STATUS.WAITING_OFFICER_FOLLOWUP;

  const updated = await withTransaction(async (conn) => {
    if (user.role === ROLES.MR && assessments) {
      await rrService.applyFinalAssessments(conn, id, assessments, user.id);
      await rrService.assertFollowUpStatusesComplete(id, conn);
    }
    const affected = await repo.updateStatusGuarded(conn, id, header.status, newStatus, {
      ...(isFinal ? { approved_at: new Date() } : {}),
    });
    if (!affected) return false; // sudah diproses pihak lain

    await repo.insertApprovalHistory(conn, {
      risk_register_id: id,
      action,
      actor_id: user.id,
      actor_role: user.role,
      from_status: header.status,
      to_status: newStatus,
      reason: user.role === ROLES.MR ? mrNotes : null,
    });

    await updateMitigationRow(conn, id, header.current_version, {
      action,
      approval_status: newStatus,
      rejection_reason: isReturn ? mrNotes : null,
    });
    return true;
  });

  if (!updated) throw ApiError.conflict('Approval sudah diproses oleh permintaan lain. Muat ulang halaman.');

  if (isFinal) {
    await notify({
      userIds: [header.risk_officer_id, header.risk_owner_id],
      title: 'Risk Register disetujui',
      message: `${header.risk_code} telah disetujui MR dan berstatus aktif.`,
      riskRegisterId: id,
    });
  } else if (isReturn) {
    await notify({
      userIds: [header.risk_officer_id],
      title: 'Tindak lanjut perlu diperbaiki',
      message: `${header.risk_code} dikembalikan Officer. Bukti dan catatan sebelumnya tersimpan sebagai history.`,
      riskRegisterId: id,
    });
  } else {
    await notify({
      userIds: await activeMrIds(),
      title: 'Risk Register disetujui Owner',
      message: `${header.risk_code} telah disetujui Risk Owner dan membutuhkan instruksi tindak lanjut dari MR.`,
      riskRegisterId: id,
    });
  }

  audit({
    req,
    action,
    entity: 'risk_registers',
    entityId: id,
    oldValue: { status: header.status },
    newValue: { status: newStatus, reason: user.role === ROLES.MR ? mrNotes : null },
  });

  return rrService.getDetail(id, user);
};

/** REJECT — wajib alasan */
const reject = async (id, reason, req) => {
  const user = req.user;
  if (!reason || !String(reason).trim()) {
    throw ApiError.badRequest('Alasan reject wajib diisi', [
      { field: 'reason', message: 'Alasan Reject wajib diisi' },
    ]);
  }
  const header = await repo.findHeader(id);
  if (!header) throw ApiError.notFound('Risk Register tidak ditemukan');

  const { newStatus, action } = assertRejectable(header, user);
  const assessments = req.body?.assessments;

  if (user.role === ROLES.MR) {
    if (assessments) {
      const errors = rrService.validateFinalAssessments(assessments);
      if (errors.length) throw ApiError.badRequest('Penilaian akhir MR tidak valid', errors);
    } else {
      await rrService.assertFollowUpStatusesComplete(id);
    }
  }

  const updated = await withTransaction(async (conn) => {
    if (user.role === ROLES.MR && assessments) {
      await rrService.applyFinalAssessments(conn, id, assessments, user.id);
      await rrService.assertFollowUpStatusesComplete(id, conn);
    }
    await rrService.archiveFollowUps(conn, id, {
      actorId: user.id,
      actorRole: user.role,
      action,
      reason: String(reason).trim(),
    });
    const affected = await repo.updateStatusGuarded(conn, id, header.status, newStatus);
    if (!affected) return false;

    await repo.insertApprovalHistory(conn, {
      risk_register_id: id,
      action,
      actor_id: user.id,
      actor_role: user.role,
      from_status: header.status,
      to_status: newStatus,
      reason: String(reason).trim(),
    });

    await updateMitigationRow(conn, id, header.current_version, {
      action,
      approval_status: newStatus,
      rejection_reason: String(reason).trim(),
    });
    return true;
  });

  if (!updated) throw ApiError.conflict('Status Risk Register sudah berubah. Muat ulang halaman.');

  await notify({
    userIds: [header.risk_officer_id],
    title: `Risk Register ditolak oleh ${user.role === ROLES.MR ? 'MR' : 'Risk Owner'}`,
    message: `${header.risk_code} ditolak. Alasan: ${String(reason).trim()}`,
    riskRegisterId: id,
  });

  audit({
    req,
    action: user.role === ROLES.MR ? 'REJECT_MR' : 'REJECT_OWNER',
    entity: 'risk_registers',
    entityId: id,
    oldValue: { status: header.status },
    newValue: { status: newStatus, reason: String(reason).trim() },
  });

  return rrService.getDetail(id, user);
};

const rejectInstruction = async (id, reason, req) => {
  const user = req.user;
  if (!reason || !String(reason).trim()) {
    throw ApiError.badRequest('Alasan pengembalian wajib diisi', [
      { field: 'reason', message: 'Alasan pengembalian wajib diisi' },
    ]);
  }
  if (user.role !== ROLES.MR) throw ApiError.forbidden('Hanya MR yang dapat mengembalikan instruksi');
  const header = await repo.findHeader(id);
  if (!header) throw ApiError.notFound('Risk Register tidak ditemukan');
  if (header.status !== STATUS.WAITING_MR_INSTRUCTION) {
    throw ApiError.conflict('Register tidak menunggu instruksi MR', { current_status: header.status });
  }

  const text = String(reason).trim();
  const updated = await withTransaction(async (conn) => {
    await rrService.archiveFollowUps(conn, id, {
      actorId: user.id,
      actorRole: user.role,
      action: 'REJECT_MR_INSTRUCTION',
      reason: text,
    });
    const affected = await repo.updateStatusGuarded(
      conn,
      id,
      header.status,
      STATUS.REJECTED_BY_MR,
      {}
    );
    if (!affected) return false;
    await repo.insertApprovalHistory(conn, {
      risk_register_id: id,
      action: 'REJECT_MR_INSTRUCTION',
      actor_id: user.id,
      actor_role: user.role,
      from_status: header.status,
      to_status: STATUS.REJECTED_BY_MR,
      reason: text,
    });
    await updateMitigationRow(conn, id, header.current_version, {
      action: 'REJECT_MR_INSTRUCTION',
      approval_status: STATUS.REJECTED_BY_MR,
      rejection_reason: text,
    });
    return true;
  });

  if (!updated) throw ApiError.conflict('Status Risk Register sudah berubah. Muat ulang halaman.');

  await notify({
    userIds: [header.risk_officer_id],
    title: 'Instruksi MR dikembalikan',
    message: `${header.risk_code} perlu diperbaiki. Alasan: ${text}`,
    riskRegisterId: id,
  });
  audit({
    req,
    action: 'REJECT_MR_INSTRUCTION',
    entity: 'risk_registers',
    entityId: id,
    oldValue: { status: header.status },
    newValue: { status: STATUS.REJECTED_BY_MR, reason: text },
  });
  return rrService.getDetail(id, user);
};

const setFollowUpStatuses = (id, statuses, req) => rrService.setFollowUpStatuses(id, statuses, req);

module.exports = { getQueue, getDetail, approve, reject, rejectInstruction, setFollowUpStatuses };
