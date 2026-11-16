const repo = require('../risk-registers/riskRegister.repository');
const rrService = require('../risk-registers/riskRegister.service');
const ApiError = require('../../utils/ApiError');
const { withTransaction } = require('../../db/pool');
const { STATUS } = require('../../config/status');
const { audit } = require('../../middlewares/audit');
const { notify } = require('../../utils/notify');
const { query } = require('../../db/pool');
const { ROLES } = require('../../config/roles');

/** Antrian approval sesuai role pemanggil */
const getQueue = async (user, filters, pagination) => {
  const statusFilter =
    user.role === ROLES.MR ? STATUS.WAITING_MR_APPROVAL : STATUS.WAITING_OWNER_APPROVAL;
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
    return { newStatus: STATUS.WAITING_MR_APPROVAL, action: 'APPROVE_OWNER' };
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

  const { newStatus, action } = assertApprovable(header, user);
  const isFinal = newStatus === STATUS.APPROVED;

  const updated = await withTransaction(async (conn) => {
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
    });

    await updateMitigationRow(conn, id, header.current_version, {
      action,
      approval_status: newStatus,
      rejection_reason: null,
    });
    return true;
  });

  if (!updated) throw ApiError.conflict('Approval sudah diproses oleh permintaan lain. Muat ulang halaman.');

  // Notifikasi
  if (isFinal) {
    await notify({
      userIds: [header.risk_officer_id, header.risk_owner_id],
      title: 'Risk Register disetujui',
      message: `${header.risk_code} telah disetujui MR dan berstatus aktif.`,
      riskRegisterId: id,
    });
  } else {
    await notify({
      userIds: await activeMrIds(),
      title: 'Menunggu approval MR',
      message: `${header.risk_code} telah disetujui Risk Owner dan membutuhkan approval MR.`,
      riskRegisterId: id,
    });
  }

  audit({
    req,
    action: isFinal ? 'APPROVE_MR' : 'APPROVE_OWNER',
    entity: 'risk_registers',
    entityId: id,
    oldValue: { status: header.status },
    newValue: { status: newStatus },
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

  const updated = await withTransaction(async (conn) => {
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

module.exports = { getQueue, getDetail, approve, reject };
