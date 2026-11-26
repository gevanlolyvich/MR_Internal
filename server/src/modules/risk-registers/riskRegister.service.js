const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const repo = require('./riskRegister.repository');
const { UPLOAD_ROOT } = require('../uploads/upload.middleware');
const ApiError = require('../../utils/ApiError');
const { STATUS, EDITABLE_STATUS, FOLLOW_UP_STATUS, FOLLOW_UP_DONE, FOLLOW_UP_RETURN } = require('../../config/status');
const { calcScore, getLevelByScore } = require('../../utils/riskLevel');
const { query, withTransaction } = require('../../db/pool');
const { audit } = require('../../middlewares/audit');
const { notify } = require('../../utils/notify');
const { ROLES } = require('../../config/roles');

const L_I_RANGE = [1, 2, 3, 4, 5];
const CONTROL_PRESENT = ['ADA', 'TIDAK_ADA'];
const CONTROL_ADEQUACY = ['MEMADAI', 'BELUM_MEMADAI'];

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const trimmed = (v) => (isNonEmptyString(v) ? v.trim() : null);

const loadLevels = async () => {
  const [rows] = await query('SELECT min_score, max_score, level, color FROM risk_level_master ORDER BY min_score ASC');
  return rows;
};

const activeMrIds = async () => {
  const [rows] = await query(`SELECT id FROM users WHERE role = 'MR' AND status = 'ACTIVE'`);
  return rows.map((r) => r.id);
};

const levelOf = (score, levels) => {
  const found = levels.find((l) => score >= l.min_score && score <= l.max_score);
  return { level: found ? found.level : 'Tidak Diketahui', color: found ? found.color : '#94a3b8' };
};

const validatePayload = async (payload, user) => {
  const errors = [];
  const push = (field, message) => errors.push({ field, message });

  if (!isNonEmptyString(payload.objective)) push('objective', 'Objective wajib diisi');

  const branchId = user.branch_id;
  if (!branchId) push('branch', 'Risk Officer harus memiliki branch di User Management');

  if (!payload.risk_owner_id) push('risk_owner_id', 'Risk Owner wajib dipilih');
  else if (branchId) {
    const owner = await repo.findValidOwner(payload.risk_owner_id, branchId);
    if (!owner) push('risk_owner_id', 'Risk Owner harus aktif dan berada pada branch yang sama dengan Risk Officer');
  }

  const categories = Array.isArray(payload.categories) ? payload.categories : [];
  if (!categories.length) push('categories', 'Minimal 1 Risk Category wajib diisi');

  const levels = await loadLevels();
  const normalized = [];

  categories.forEach((cat, ci) => {
    const cPrefix = `categories[${ci}]`;
    if (!cat.category_id) push(`${cPrefix}.category_id`, 'Risk Category wajib dipilih');
    const events = Array.isArray(cat.events) ? cat.events : [];
    if (!events.length) push(`${cPrefix}.events`, 'Minimal 1 Risk Event wajib diisi');

    events.forEach((ev, ei) => {
      const ePrefix = `${cPrefix}.events[${ei}]`;
      if (!isNonEmptyString(ev.name)) push(`${ePrefix}.name`, 'Risk Event wajib diisi');
      const causes = Array.isArray(ev.causes) ? ev.causes : [];
      if (!causes.length) push(`${ePrefix}.causes`, 'Minimal 1 Risk Cause wajib diisi');

      causes.forEach((cs, si) => {
        const p = `${ePrefix}.causes[${si}]`;
        if (!isNonEmptyString(cs.name)) push(`${p}.name`, 'Risk Cause wajib diisi');
        if (cs.source_id && !Number.isInteger(Number(cs.source_id))) push(`${p}.source_id`, 'Sumber Risiko tidak valid');
        if (!isNonEmptyString(cs.severity_description)) push(`${p}.severity_description`, 'Deskripsi Akibat/Potensi Kerugian wajib diisi');
        const rp = Number(cs.rp_amount);
        if (cs.rp_amount === undefined || cs.rp_amount === null || cs.rp_amount === '' || Number.isNaN(rp)) {
          push(`${p}.rp_amount`, 'Nilai Rp wajib diisi');
        } else if (rp < 0) {
          push(`${p}.rp_amount`, 'Nilai Rp tidak boleh negatif');
        }
        if (!isNonEmptyString(cs.work_unit)) push(`${p}.work_unit`, 'Unit Kerja / Unit Usaha wajib diisi');
      });

      const inhL = Number(ev.inherent && ev.inherent.likelihood);
      const inhI = Number(ev.inherent && ev.inherent.impact);
      if (!L_I_RANGE.includes(inhL)) push(`${ePrefix}.inherent.likelihood`, 'Inherent Likelihood wajib 1-5');
      if (!L_I_RANGE.includes(inhI)) push(`${ePrefix}.inherent.impact`, 'Inherent Impact wajib 1-5');

      const control = ev.control || {};
      if (!CONTROL_PRESENT.includes(control.present)) push(`${ePrefix}.control.present`, 'Existing Control (Ada/Tidak Ada) wajib dipilih');
      if (!CONTROL_ADEQUACY.includes(control.adequacy)) push(`${ePrefix}.control.adequacy`, 'Control Adequacy wajib dipilih');
      const pct = Number(control.implementation);
      if (!Number.isInteger(pct) || pct < 0 || pct > 100) push(`${ePrefix}.control.implementation`, 'Dijalankan (%) harus bilangan 0-100');

      const resL = Number(ev.residual && ev.residual.likelihood);
      const resI = Number(ev.residual && ev.residual.impact);
      if (!L_I_RANGE.includes(resL)) push(`${ePrefix}.residual.likelihood`, 'Residual Likelihood wajib 1-5');
      if (!L_I_RANGE.includes(resI)) push(`${ePrefix}.residual.impact`, 'Residual Impact wajib 1-5');

      const mitigationItems = Array.isArray(ev.mitigation_items) ? ev.mitigation_items : [];
      if (!mitigationItems.length) push(`${ePrefix}.mitigation_items`, 'Risk Treatment wajib memiliki minimal 1 item mitigasi');
      mitigationItems.forEach((mi, miIdx) => {
        const miPrefix = `${ePrefix}.mitigation_items[${miIdx}]`;
        if (!isNonEmptyString(mi && mi.description)) push(`${miPrefix}.description`, 'Mitigation item tidak boleh kosong');
      });

      const aftL = Number(ev.after && ev.after.likelihood);
      const aftI = Number(ev.after && ev.after.impact);
      if (!L_I_RANGE.includes(aftL)) push(`${ePrefix}.after.likelihood`, 'Risk After Mitigation Likelihood wajib 1-5');
      if (!L_I_RANGE.includes(aftI)) push(`${ePrefix}.after.impact`, 'Risk After Mitigation Impact wajib 1-5');

      const hasError = errors.some((e) => e.field.startsWith(ePrefix) || e.field.startsWith(cPrefix));
      if (!hasError) {
        const inherent_score = calcScore(inhL, inhI);
        const residual_score = calcScore(resL, resI);
        const after_score = calcScore(aftL, aftI);
        normalized.push({
          category_id: Number(cat.category_id),
          name: ev.name.trim(),
          causes: causes.map((cs) => ({
            name: cs.name.trim(),
            source_id: cs.source_id ? Number(cs.source_id) : null,
            severity_description: cs.severity_description || null,
            rp_amount: cs.rp_amount === '' || cs.rp_amount === null || cs.rp_amount === undefined ? null : Number(cs.rp_amount),
            work_unit: cs.work_unit ? cs.work_unit.trim() : null,
          })),
          inherent: { likelihood: inhL, impact: inhI, score: inherent_score, ...levelOf(inherent_score, levels) },
          control: { present: control.present, adequacy: control.adequacy, implementation: pct },
          residual: { likelihood: resL, impact: resI, score: residual_score, ...levelOf(residual_score, levels) },
          mitigation_items: mitigationItems.map((mi, idx) => {
            const instructionText = trimmed(mi.instruction?.text) || trimmed(mi.follow_up) || '';
            const oldInstruction = mi.instruction && typeof mi.instruction === 'object' ? mi.instruction : {};
            return {
              id: mi.id || crypto.randomUUID(),
              description: mi.description.trim(),
              follow_up: instructionText,
              instruction: {
                text: instructionText,
                note: trimmed(oldInstruction.note) || trimmed(mi.instruction_note),
                by: oldInstruction.by || null,
                at: oldInstruction.at || null,
              },
              realization: {
                note: trimmed(mi.realization?.note) || trimmed(mi.realization_note),
                by: mi.realization?.by || mi.realization_by || null,
                at: mi.realization?.at || mi.realization_at || null,
              },
              mr_note: trimmed(mi.mr_note),
              order: idx + 1,
              documents: Array.isArray(mi.documents) ? mi.documents : [],
              follow_up_status: Object.values(FOLLOW_UP_STATUS).includes(mi.follow_up_status) ? mi.follow_up_status : null,
              follow_up_history: Array.isArray(mi.follow_up_history) ? mi.follow_up_history : [],
            };
          }),
          after: { likelihood: aftL, impact: aftI, score: after_score, ...levelOf(after_score, levels) },
        });
      }
    });
  });

  return { errors, normalized, branchId, levels };
};

const buildNested = (normalized) => {
  const tree = [];
  normalized.forEach((item) => {
    let cat = tree.find((c) => c.category_id === item.category_id);
    if (!cat) {
      cat = { category_id: item.category_id, events: [] };
      tree.push(cat);
    }
    let ev = cat.events.find((e) => e.name === item.name);
    if (!ev) {
      ev = {
        name: item.name,
        causes: item.causes || [],
        inherent: item.inherent,
        control: item.control,
        residual: item.residual,
        mitigation_items: item.mitigation_items || [],
        after: item.after,
      };
      cat.events.push(ev);
    }
    return undefined;
  });
  return tree;
};

const buildSnapshot = (header, nested) => ({
  objective: header.objective,
  risk_code: header.risk_code,
  generated_at: new Date().toISOString(),
  items: nested.flatMap((cat) =>
    (cat.events || []).map((ev) => ({
      category: cat.category_name || cat.category_id,
      event: ev.name,
      causes: (ev.causes || []).map((cs) => ({
        name: cs.name,
        source_id: cs.source_id,
        severity_description: cs.severity_description,
        rp_amount: cs.rp_amount,
        work_unit: cs.work_unit,
      })),
      inherent: ev.inherent || null,
      control: ev.control || null,
      residual: ev.residual || null,
      mitigation_items: ev.mitigation_items || [],
      after: ev.after || null,
    }))
  ),
});

const parseMitigationItems = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
};

const assertComplete = (header, nested) => {
  const errors = [];
  if (!header || !isNonEmptyString(header.objective)) errors.push({ field: 'objective', message: 'Objective wajib diisi' });
  if (!header.risk_owner_id) errors.push({ field: 'risk_owner_id', message: 'Risk Owner wajib dipilih' });
  if (!nested.length) errors.push({ field: 'categories', message: 'Minimal 1 Risk Category wajib diisi' });

  nested.forEach((cat) => {
    (cat.events || []).forEach((ev) => {
      const base = `categories[${cat.category_id}]::events::${ev.name}`;
      const hasInherent = ev.inherent ? true : ev.inherent_score !== null && ev.inherent_score !== undefined;
      const hasResidual = ev.residual ? true : ev.residual_score !== null && ev.residual_score !== undefined;
      const hasAfter = ev.after ? true : ev.after_score !== null && ev.after_score !== undefined;
      const mits = parseMitigationItems(ev.mitigation_items);
      if (!ev.causes || !ev.causes.length) errors.push({ field: `${base}::causes`, message: 'Setiap event harus memiliki minimal 1 Risk Cause' });
      if (!hasInherent) errors.push({ field: `${base}::inherent`, message: 'Inherent Risk belum lengkap' });
      if (!hasResidual) errors.push({ field: `${base}::residual`, message: 'Residual Risk belum lengkap' });
      if (!mits.length) errors.push({ field: `${base}::mitigation_items`, message: 'Risk Treatment wajib memiliki minimal 1 item mitigasi' });
      mits.forEach((mi, mii) => {
        if (!isNonEmptyString(mi && mi.description)) errors.push({ field: `${base}::mitigation_items[${mii}].description`, message: 'Deskripsi mitigasi wajib diisi' });
      });
      if (!hasAfter) errors.push({ field: `${base}::after`, message: 'Risk After Mitigation belum lengkap' });
    });
  });

  if (errors.length) throw ApiError.badRequest('Risk Register belum lengkap', errors);
};

const createRegister = async (payload, req) => {
  const user = req.user;
  const { errors, normalized, branchId } = await validatePayload(payload, user);
  if (errors.length) throw ApiError.badRequest('Validasi gagal', errors);

  const year = new Date().getFullYear();
  const nested = buildNested(normalized);

  const registerId = await withTransaction(async (conn) => {
    const riskCode = await repo.nextRiskCode(conn, year);
    const id = await repo.insertRegister(conn, {
      risk_code: riskCode,
      year,
      branch_id: branchId,
      risk_officer_id: user.id,
      risk_owner_id: Number(payload.risk_owner_id),
      objective: payload.objective.trim(),
      status: STATUS.DRAFT,
      created_by: user.id,
    });
    await repo.replaceNested(conn, id, nested);

    const header = await repo.findHeader(id, conn);

    await repo.insertMitigationHistory(conn, {
      risk_register_id: id,
      version: 1,
      snapshot: buildSnapshot(header, nested),
      action: 'CREATE',
      approval_status: STATUS.DRAFT,
      created_by: user.id,
    });
    return id;
  });

  audit({ req, action: 'CREATE_RISK_REGISTER', entity: 'risk_registers', entityId: registerId, newValue: { objective: payload.objective } });
  return getDetail(registerId, user);
};

const updateRegister = async (id, payload, req) => {
  const user = req.user;
  const header = await repo.findHeader(id);
  if (!header) throw ApiError.notFound('Risk Register tidak ditemukan');
  if (!EDITABLE_STATUS.includes(header.status)) {
    throw ApiError.conflict(`Tidak dapat mengedit Risk Register dengan status ${header.status}`);
  }
  if (user.role === ROLES.RISK_OFFICER && header.risk_officer_id !== user.id) {
    throw ApiError.forbidden('Anda hanya dapat mengedit Risk Register milik Anda');
  }

  const { errors, normalized, branchId } = await validatePayload(payload, user);
  if (errors.length) throw ApiError.badRequest('Validasi gagal', errors);

  const nested = buildNested(normalized);

  await withTransaction(async (conn) => {
    await repo.updateHeader(conn, id, {
      objective: payload.objective.trim(),
      risk_owner_id: Number(payload.risk_owner_id),
      branch_id: branchId,
      updated_at: new Date(),
    });
    await repo.replaceNested(conn, id, nested);

    const [verRows] = await conn.query(
      'SELECT COALESCE(MAX(version), 0) AS maxv FROM risk_mitigation_histories WHERE risk_register_id = ?',
      [id]
    );
    const nextVersion = Number(verRows[0].maxv) + 1;

    await repo.insertMitigationHistory(conn, {
      risk_register_id: id,
      version: nextVersion,
      snapshot: buildSnapshot(header, nested),
      action: 'UPDATE_MITIGATION',
      approval_status: header.status,
      created_by: user.id,
    });
    await repo.updateHeader(conn, id, { current_version: nextVersion });
  });

  audit({ req, action: 'UPDATE_MITIGATION', entity: 'risk_registers', entityId: id, newValue: { objective: payload.objective } });
  return getDetail(id, user);
};

const resolveSubmitTarget = async () => STATUS.WAITING_OWNER_APPROVAL;

const submitRegister = async (id, req) => {
  const user = req.user;
  const header = await repo.findHeader(id);
  if (!header) throw ApiError.notFound('Risk Register tidak ditemukan');
  if (!EDITABLE_STATUS.includes(header.status)) {
    throw ApiError.conflict(`Tidak dapat submit dengan status ${header.status}`);
  }
  if (user.role === ROLES.RISK_OFFICER && header.risk_officer_id !== user.id) {
    throw ApiError.forbidden('Anda hanya dapat submit Risk Register milik Anda');
  }

  const nested = await repo.findNested(id);
  assertComplete(header, nested);

  const ownerOk = await repo.findValidOwner(header.risk_owner_id, header.branch_id);
  if (!ownerOk) throw ApiError.badRequest('Risk Owner tidak valid (harus aktif dan satu branch dengan Risk Officer)');

  const targetStatus = await resolveSubmitTarget(id, header);

  await withTransaction(async (conn) => {
    const affected = await repo.updateStatusGuarded(conn, id, header.status, targetStatus, {
      submitted_at: new Date(),
    });
    if (!affected) throw ApiError.conflict('Status Risk Register telah berubah, muat ulang halaman');

    await repo.insertApprovalHistory(conn, {
      risk_register_id: id,
      action: 'SUBMIT',
      actor_id: user.id,
      actor_role: user.role,
      from_status: header.status,
      to_status: targetStatus,
    });

    await conn.query(
      `UPDATE risk_mitigation_histories
          SET action = 'SUBMIT', approval_status = ?, rejection_reason = NULL
        WHERE risk_register_id = ? AND version = ?`,
      [targetStatus, id, header.current_version]
    );
  });

  await notify({
    userIds: [header.risk_owner_id],
    title: 'Menunggu approval Risk Register',
    message: `${header.risk_code} membutuhkan approval Risk Owner sebelum diteruskan ke MR.`,
    riskRegisterId: id,
  });

  audit({ req, action: 'SUBMIT_RISK_REGISTER', entity: 'risk_registers', entityId: id, oldValue: { status: header.status }, newValue: { status: targetStatus } });
  return getDetail(id, user);
};

const getList = async (filters, scope, pagination) => {
  const { rows, total } = await repo.findList(filters, scope, pagination);
  const levels = await loadLevels();
  const levelOfScore = (s) => (s === null || s === undefined ? null : levelOf(Number(s), levels));
  const data = rows.map((r) => ({
    ...r,
    inherent: r.inherent_score === null ? null : { score: r.inherent_score, ...levelOfScore(r.inherent_score) },
    residual: r.residual_score === null ? null : { score: r.residual_score, ...levelOfScore(r.residual_score) },
    after: r.after_score === null ? null : { score: r.after_score, ...levelOfScore(r.after_score) },
  }));
  return { items: data, total, page: pagination.page, limit: pagination.limit };
};


const getDetail = async (id, user) => {
  const header = await repo.findHeader(id);
  if (!header) throw ApiError.notFound('Risk Register tidak ditemukan');

  if (user) {
    if (user.role === ROLES.RISK_OFFICER && header.risk_officer_id !== user.id) {
      throw ApiError.forbidden('Anda tidak memiliki akses ke Risk Register ini');
    }
    if (user.role === ROLES.RISK_OWNER && header.risk_owner_id !== user.id) {
      throw ApiError.forbidden('Anda tidak memiliki akses ke Risk Register ini');
    }
  }

  const nested = await repo.findNested(id);
  const levels = await loadLevels();

  const nestedOut = nested.map((cat) => ({
    ...cat,
    events: cat.events || [],
  }));

  const flat = nestedOut.flatMap((c) => c.events || []);
  const inhMax = flat.length ? Math.max(...flat.map((e) => Number(e.inherent_score)).filter((v) => v !== null)) : null;
  const resMax = flat.length ? Math.max(...flat.map((e) => Number(e.residual_score)).filter((v) => v !== null)) : null;
  const aftMax = flat.length ? Math.max(...flat.map((e) => Number(e.after_score)).filter((v) => v !== null)) : null;

  const tolerance = (await query('SELECT max_score FROM risk_tolerance_config WHERE id = 1'))[0][0] || { max_score: 9 };

  return {
    ...header,
    can_edit: EDITABLE_STATUS.includes(header.status) && (!user || header.risk_officer_id === user.id || user.role === ROLES.MR),
    aggregates: {
      inherent: inhMax === null ? null : { score: inhMax, ...levelOf(inhMax, levels) },
      residual: resMax === null ? null : { score: resMax, ...levelOf(resMax, levels) },
      after:
        aftMax === null
          ? null
          : {
              score: aftMax,
              ...levelOf(aftMax, levels),
              tolerance: Number(aftMax) <= Number(tolerance.max_score) ? 'Within Risk Tolerance' : 'Exceeds Risk Tolerance',
            },
    },
    categories: nestedOut,
  };
};

const getHistory = async (id) => {
  const header = await repo.findHeader(id);
  if (!header) throw ApiError.notFound('Risk Register tidak ditemukan');
  const [approvals, mitigations, auditLogs] = await Promise.all([
    repo.findApprovals(id),
    repo.findMitigations(id),
    repo.findAuditForRegister(id),
  ]);
  return { approvals, mitigations, audit: auditLogs };
};

const getMonitoringFollowUps = async (filters, scope) => {
  const list = await getList(filters, scope, { page: 1, limit: 500 });
  const items = [];

  for (const reg of list.items) {
    const detail = await getDetail(reg.id);
    (detail.categories || []).forEach((cat) => {
      (cat.events || []).forEach((ev) => {
        parseMitigationItems(ev.mitigation_items).forEach((it, index) => {
          items.push({
            id: `${reg.id}:${ev.id}:${it.id || index}`,
            register_id: reg.id,
            risk_code: reg.risk_code,
            branch_name: reg.branch_name,
            register_status: reg.status,
            category_name: cat.category_name,
            event_id: ev.id,
            event_name: ev.name,
            item_id: it.id || null,
            description: it.description || '-',
            instruction: it.instruction || null,
            realization: it.realization || null,
            documents: Array.isArray(it.documents) ? it.documents : [],
            follow_up_status: it.follow_up_status || null,
            mr_note: it.mr_note || '',
            updated_at: reg.updated_at,
          });
        });
      });
    });
  }

  return { items, total: items.length };
};

const deleteRegister = async (id, req) => {
  const user = req.user;
  const header = await repo.findHeader(id);
  if (!header) throw ApiError.notFound('Risk Register tidak ditemukan');
  if (header.status !== STATUS.DRAFT) throw ApiError.conflict('Hanya Risk Register berstatus Draft yang dapat dihapus');
  if (user.role === ROLES.RISK_OFFICER && header.risk_officer_id !== user.id) {
    throw ApiError.forbidden('Anda hanya dapat menghapus Risk Register milik Anda');
  }
  await repo.softDelete(id);
  audit({ req, action: 'DELETE_RISK_REGISTER', entity: 'risk_registers', entityId: id, oldValue: { risk_code: header.risk_code } });
  return { id, deleted: true };
};

const findMitigationItem = (nested, itemId) => {
  for (const cat of nested) {
    for (const ev of cat.events || []) {
      const items = parseMitigationItems(ev.mitigation_items);
      ev.mitigation_items = items;
      const index = items.findIndex((it) => it.id != null && String(it.id) === String(itemId));
      if (index !== -1) return { event: ev, items, item: items[index], index };
    }
  }
  return null;
};

const collectDocuments = (items) => {
  const out = [];
  (items || []).forEach((it) => {
    (it.documents || []).forEach((d) => out.push({ ...d, itemId: it.id, archived: false }));
    (it.follow_up_history || []).forEach((h) =>
      (h.documents || []).forEach((d) => out.push({ ...d, itemId: it.id, archived: true }))
    );
  });
  return out;
};

const assertDocumentEditable = (header, user) => {
  if (header.status !== STATUS.WAITING_OFFICER_FOLLOWUP) {
    throw ApiError.conflict('Bukti dokumen hanya dapat diunggah pada tahap tindak lanjut Officer');
  }
  if (header.risk_officer_id !== user.id) {
    throw ApiError.forbidden('Anda hanya dapat mengelola dokumen Risk Register milik Anda');
  }
};

const assertItemEditable = (item) => {
  if (item?.follow_up_status === FOLLOW_UP_DONE) {
    throw ApiError.conflict('Item yang sudah dinyatakan sesuai tidak dapat diubah');
  }
};

const uploadDocuments = async (id, itemId, files, req) => {
  const header = await repo.findHeader(id);
  if (!header) throw ApiError.notFound('Risk Register tidak ditemukan');
  assertDocumentEditable(header, req.user);
  if (!files || !files.length) throw ApiError.badRequest('Tidak ada dokumen yang diunggah');
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

  try {
    await withTransaction(async (conn) => {
      const nested = await repo.findNested(id, conn);
      const found = findMitigationItem(nested, itemId);
      if (!found) throw ApiError.notFound('Item mitigasi tidak ditemukan');
      assertItemEditable(found.item);
      const existingDocs = found.item.documents || [];
      if (existingDocs.length + files.length > 5) throw ApiError.badRequest('Maksimal 5 dokumen per item mitigasi');
      const docs = files.map((f) => ({
        id: f.docId,
        original_name: f.originalname,
        storage_name: f.filename,
        mime_type: f.mimetype,
        size: f.size,
        uploaded_at: new Date().toISOString(),
        uploaded_by: req.user.id,
      }));
      found.item.documents = [...existingDocs, ...docs];
      if (note) {
        found.item.realization = { note, by: req.user.id, at: new Date().toISOString() };
      }
      await repo.updateEventMitigationItems(conn, found.event.id, found.items);
    });
  } catch (err) {
    files.forEach((f) => {
      try {
        fs.unlinkSync(path.join(UPLOAD_ROOT, String(id), f.filename));
      } catch {
        /* file sudah terhapus atau gagal dibuat */
      }
    });
    throw err;
  }

  audit({
    req,
    action: 'UPLOAD_MITIGATION_DOCUMENT',
    entity: 'risk_registers',
    entityId: Number(id),
    newValue: { itemId, files: files.map((f) => f.originalname), ...(note ? { note } : {}) },
  });
  return getDetail(id, req.user);
};

const removeDocument = async (id, itemId, docId, req) => {
  const header = await repo.findHeader(id);
  if (!header) throw ApiError.notFound('Risk Register tidak ditemukan');
  assertDocumentEditable(header, req.user);

  let removed = null;
  await withTransaction(async (conn) => {
    const nested = await repo.findNested(id, conn);
      const found = findMitigationItem(nested, itemId);
      if (!found) throw ApiError.notFound('Item mitigasi tidak ditemukan');
      assertItemEditable(found.item);
      const idx = (found.item.documents || []).findIndex((d) => d.id === docId);
    if (idx === -1) throw ApiError.notFound('Dokumen tidak ditemukan pada item mitigasi ini');
    [removed] = found.item.documents.splice(idx, 1);
    await repo.updateEventMitigationItems(conn, found.event.id, found.items);
  });

  try {
    fs.unlinkSync(path.join(UPLOAD_ROOT, String(id), path.basename(removed.storage_name)));
  } catch {
    /* file fisik sudah tidak ada */
  }

  audit({
    req,
    action: 'DELETE_MITIGATION_DOCUMENT',
    entity: 'risk_registers',
    entityId: Number(id),
    oldValue: { itemId, document: removed.original_name },
  });
  return getDetail(id, req.user);
};

const getDocumentForDownload = async (id, docId, user) => {
  await getDetail(id, user);
  const nested = await repo.findNested(id);
  const items = nested.flatMap((cat) =>
    (cat.events || []).flatMap((ev) => parseMitigationItems(ev.mitigation_items))
  );
  const doc = collectDocuments(items).find((d) => d.id === docId);
  if (!doc) throw ApiError.notFound('Dokumen tidak ditemukan');
  const filePath = path.join(UPLOAD_ROOT, String(id), path.basename(doc.storage_name));
  if (!fs.existsSync(filePath)) throw ApiError.notFound('File dokumen tidak ditemukan di server');
  return { doc, filePath };
};

const pushFollowUpHistory = (item, meta) => {
  item.follow_up_history = Array.isArray(item.follow_up_history) ? item.follow_up_history : [];
  item.follow_up_history.push({
    archived_at: new Date().toISOString(),
    archived_by: meta.actorId,
    actor_role: meta.actorRole,
    action: meta.action,
    reason: meta.reason || null,
    instruction: item.instruction ? { ...item.instruction } : null,
    follow_up: item.follow_up || null,
    realization: item.realization ? { ...item.realization } : null,
    mr_note: item.mr_note || null,
    follow_up_status: item.follow_up_status || null,
    documents: (item.documents || []).map((d) => ({ ...d })),
  });
};

const updateCurrentMitigationRow = async (conn, id, header, action, status, reason = null) => {
  await conn.query(
    `UPDATE risk_mitigation_histories
        SET action = ?, approval_status = ?, rejection_reason = ?
      WHERE risk_register_id = ? AND version = ?`,
    [action, status, reason, id, header.current_version]
  );
};

const validateInstructionItems = (items) => {
  const errors = [];
  if (!Array.isArray(items) || !items.length) {
    return [{ field: 'items', message: 'Minimal 1 instruksi tindak lanjut wajib dikirim' }];
  }
  items.forEach((s, i) => {
    if (!s || !s.itemId) errors.push({ field: `items[${i}].itemId`, message: 'Item mitigasi wajib dipilih' });
    if (!isNonEmptyString(s?.text)) errors.push({ field: `items[${i}].text`, message: 'Instruksi tindak lanjut wajib diisi' });
    if (!isNonEmptyString(s?.note)) errors.push({ field: `items[${i}].note`, message: 'Keterangan MR wajib diisi' });
  });
  return errors;
};

const setMrInstructions = async (id, items, req) => {
  const user = req.user;
  if (user.role !== ROLES.MR) throw ApiError.forbidden('Hanya MR yang dapat memberi instruksi tindak lanjut');
  const header = await repo.findHeader(id);
  if (!header) throw ApiError.notFound('Risk Register tidak ditemukan');
  if (header.status !== STATUS.WAITING_MR_INSTRUCTION) {
    throw ApiError.conflict('Register tidak menunggu instruksi MR', { current_status: header.status });
  }
  const errors = validateInstructionItems(items);
  if (errors.length) throw ApiError.badRequest('Instruksi tindak lanjut tidak valid', errors);

  await withTransaction(async (conn) => {
    const nested = await repo.findNested(id, conn);
    const touched = new Map();
    items.forEach((s) => {
      const found = findMitigationItem(nested, s.itemId);
      if (!found) throw ApiError.notFound('Item mitigasi tidak ditemukan');
      const text = s.text.trim();
      found.item.follow_up = text;
      found.item.instruction = { text, note: s.note.trim(), by: user.id, at: new Date().toISOString() };
      found.item.realization = { note: null, by: null, at: null };
      found.item.follow_up_status = null;
      found.item.mr_note = null;
      pushFollowUpHistory(found.item, {
        actorId: user.id,
        actorRole: user.role,
        action: 'MR_INSTRUCTION',
        reason: s.note.trim(),
      });
      touched.set(found.event.id, found.items);
    });
    for (const [eventId, eventItems] of touched) {
      await repo.updateEventMitigationItems(conn, eventId, eventItems);
    }

    const affected = await repo.updateStatusGuarded(conn, id, header.status, STATUS.WAITING_OFFICER_FOLLOWUP);
    if (!affected) throw ApiError.conflict('Status Risk Register telah berubah, muat ulang halaman');
    await repo.insertApprovalHistory(conn, {
      risk_register_id: id,
      action: 'MR_INSTRUCTION',
      actor_id: user.id,
      actor_role: user.role,
      from_status: header.status,
      to_status: STATUS.WAITING_OFFICER_FOLLOWUP,
    });
    await updateCurrentMitigationRow(conn, id, header, 'MR_INSTRUCTION', STATUS.WAITING_OFFICER_FOLLOWUP);
  });

  await notify({
    userIds: [header.risk_officer_id],
    title: 'Instruksi tindak lanjut tersedia',
    message: `${header.risk_code} telah diberi instruksi tindak lanjut oleh MR. Unggah bukti dan keterangan realisasi Anda.`,
    riskRegisterId: id,
  });
  audit({
    req,
    action: 'MR_INSTRUCTION',
    entity: 'risk_registers',
    entityId: Number(id),
    oldValue: { status: header.status },
    newValue: { status: STATUS.WAITING_OFFICER_FOLLOWUP },
  });
  return getDetail(id, user);
};

const validateRealizationItems = (items) => {
  const errors = [];
  if (!Array.isArray(items) || !items.length) {
    return [{ field: 'items', message: 'Minimal 1 keterangan realisasi wajib dikirim' }];
  }
  items.forEach((s, i) => {
    if (!s || !s.itemId) errors.push({ field: `items[${i}].itemId`, message: 'Item mitigasi wajib dipilih' });
    if (!isNonEmptyString(s?.note)) errors.push({ field: `items[${i}].note`, message: 'Keterangan realisasi wajib diisi' });
  });
  return errors;
};

const submitFollowUpRealization = async (id, items, req) => {
  const user = req.user;
  if (user.role !== ROLES.RISK_OFFICER) throw ApiError.forbidden('Hanya Risk Officer yang dapat mengirim realisasi');
  const header = await repo.findHeader(id);
  if (!header) throw ApiError.notFound('Risk Register tidak ditemukan');
  if (header.risk_officer_id !== user.id) throw ApiError.forbidden('Anda hanya dapat mengelola Risk Register milik Anda');
  if (header.status !== STATUS.WAITING_OFFICER_FOLLOWUP) {
    throw ApiError.conflict('Register tidak menunggu realisasi Officer', { current_status: header.status });
  }
  const errors = validateRealizationItems(items);
  if (errors.length) throw ApiError.badRequest('Realisasi tindak lanjut tidak valid', errors);

  await withTransaction(async (conn) => {
    const nested = await repo.findNested(id, conn);
    const touched = new Map();
    items.forEach((s) => {
      const found = findMitigationItem(nested, s.itemId);
      if (!found) throw ApiError.notFound('Item mitigasi tidak ditemukan');
      assertItemEditable(found.item);
      found.item.realization = { note: s.note.trim(), by: user.id, at: new Date().toISOString() };
      pushFollowUpHistory(found.item, {
        actorId: user.id,
        actorRole: user.role,
        action: 'OFFICER_REALIZATION',
        reason: s.note.trim(),
      });
      touched.set(found.event.id, found.items);
    });
    for (const [eventId, eventItems] of touched) {
      await repo.updateEventMitigationItems(conn, eventId, eventItems);
    }

    const affected = await repo.updateStatusGuarded(conn, id, header.status, STATUS.WAITING_MR_APPROVAL);
    if (!affected) throw ApiError.conflict('Status Risk Register telah berubah, muat ulang halaman');
    await repo.insertApprovalHistory(conn, {
      risk_register_id: id,
      action: 'OFFICER_REALIZATION',
      actor_id: user.id,
      actor_role: user.role,
      from_status: header.status,
      to_status: STATUS.WAITING_MR_APPROVAL,
    });
    await updateCurrentMitigationRow(conn, id, header, 'OFFICER_REALIZATION', STATUS.WAITING_MR_APPROVAL);
  });

  await notify({
    userIds: await activeMrIds(),
    title: 'Hasil tindak lanjut menunggu penilaian MR',
    message: `${header.risk_code} telah dilengkapi bukti dan catatan realisasi. Mohon dinilai.`,
    riskRegisterId: id,
  });
  audit({
    req,
    action: 'OFFICER_REALIZATION',
    entity: 'risk_registers',
    entityId: Number(id),
    oldValue: { status: header.status },
    newValue: { status: STATUS.WAITING_MR_APPROVAL },
  });
  return getDetail(id, user);
};

const validateFinalAssessments = (assessments) => {
  const errors = [];
  if (!Array.isArray(assessments) || !assessments.length) {
    return [{ field: 'assessments', message: 'Minimal 1 penilaian akhir wajib dikirim' }];
  }
  assessments.forEach((s, i) => {
    if (!s || !s.itemId) errors.push({ field: `assessments[${i}].itemId`, message: 'Item mitigasi wajib dipilih' });
    if (!s || !Object.values(FOLLOW_UP_STATUS).includes(s.status)) {
      errors.push({ field: `assessments[${i}].status`, message: 'Status tindak lanjut tidak valid' });
    }
    if (!isNonEmptyString(s?.note)) errors.push({ field: `assessments[${i}].note`, message: 'Keterangan MR wajib diisi' });
  });
  return errors;
};

const applyFinalAssessments = async (conn, id, assessments, actorId) => {
  const nested = await repo.findNested(id, conn);
  const touched = new Map();
  assessments.forEach((s) => {
    const found = findMitigationItem(nested, s.itemId);
    if (!found) throw ApiError.notFound('Item mitigasi tidak ditemukan');
    const note = s.note.trim();
    if (found.item.follow_up_status === FOLLOW_UP_DONE) {
      const unchanged = found.item.follow_up_status === s.status && found.item.mr_note === note;
      if (!unchanged) throw ApiError.conflict('Penilaian MR pada item yang sudah sesuai tidak dapat diubah');
      return;
    }
    const isReturn = FOLLOW_UP_RETURN.includes(s.status);
    found.item.follow_up_status = s.status;
    found.item.mr_note = note;
    if (isReturn) {
      pushFollowUpHistory(found.item, {
        actorId,
        actorRole: ROLES.MR,
        action: 'MR_FINAL_RETURN',
        reason: note,
      });
    } else {
      pushFollowUpHistory(found.item, {
        actorId,
        actorRole: ROLES.MR,
        action: 'MR_FINAL',
        reason: note,
      });
    }
    touched.set(found.event.id, found.items);
  });
  for (const [eventId, eventItems] of touched) {
    await repo.updateEventMitigationItems(conn, eventId, eventItems);
  }
};

const resolveMrFinalStatus = async (id, assessments) => {
  if (assessments) {
    const allDone = assessments.every((a) => a.status === FOLLOW_UP_DONE);
    return allDone ? STATUS.APPROVED : STATUS.WAITING_OFFICER_FOLLOWUP;
  }
  const nested = await repo.findNested(id);
  const allDone = nested.every((cat) =>
    (cat.events || []).every((ev) =>
      parseMitigationItems(ev.mitigation_items).every((it) => it.follow_up_status === FOLLOW_UP_DONE)
    )
  );
  return allDone ? STATUS.APPROVED : STATUS.WAITING_OFFICER_FOLLOWUP;
};

const setFollowUpStatuses = async (id, assessments, req) => {
  if (req.user.role !== ROLES.MR) throw ApiError.forbidden('Hanya MR yang dapat menilai tindak lanjut');
  const header = await repo.findHeader(id);
  if (!header) throw ApiError.notFound('Risk Register tidak ditemukan');
  if (header.status !== STATUS.WAITING_MR_APPROVAL) {
    throw ApiError.conflict('Status register tidak menunggu approval MR', { current_status: header.status });
  }
  const errors = validateFinalAssessments(assessments);
  if (errors.length) throw ApiError.badRequest('Penilaian akhir MR tidak valid', errors);

  await withTransaction(async (conn) => {
    await applyFinalAssessments(conn, id, assessments, req.user.id);
    await assertFollowUpStatusesComplete(id, conn);
  });

  audit({
    req,
    action: 'SET_FOLLOW_UP_STATUS',
    entity: 'risk_registers',
    entityId: Number(id),
    newValue: { assessments },
  });
  return getDetail(id, req.user);
};

const assertFollowUpStatusesComplete = async (id, conn) => {
  const nested = await repo.findNested(id, conn);
  const missing = [];
  nested.forEach((cat) => {
    (cat.events || []).forEach((ev) => {
      parseMitigationItems(ev.mitigation_items).forEach((it) => {
        if (!Object.values(FOLLOW_UP_STATUS).includes(it.follow_up_status) || !isNonEmptyString(it.mr_note)) {
          missing.push({
            itemId: it.id || null,
            event: ev.name,
            description: it.description || '-',
          });
        }
      });
    });
  });
  if (missing.length) {
    throw ApiError.badRequest('Penilaian akhir MR belum lengkap', [
      { field: 'assessments', message: `${missing.length} item mitigasi belum diberi status/keterangan`, items: missing },
    ]);
  }
};

const archiveFollowUps = async (conn, id, meta) => {
  const nested = await repo.findNested(id, conn);
  for (const cat of nested) {
    for (const ev of cat.events || []) {
      const items = parseMitigationItems(ev.mitigation_items);
      let changed = false;
      items.forEach((it) => {
        const hasCurrent =
          it.follow_up ||
          it.realization?.note ||
          it.mr_note ||
          (it.documents || []).length ||
          it.follow_up_status;
        if (!hasCurrent) return;
        pushFollowUpHistory(it, meta);
        changed = true;
      });
      if (changed) await repo.updateEventMitigationItems(conn, ev.id, items);
    }
  }
};

module.exports = {
  createRegister,
  updateRegister,
  submitRegister,
  getList,
  getDetail,
  getHistory,
  getMonitoringFollowUps,
  deleteRegister,
  uploadDocuments,
  removeDocument,
  getDocumentForDownload,
  setMrInstructions,
  submitFollowUpRealization,
  setFollowUpStatuses,
  validateFinalAssessments,
  applyFinalAssessments,
  resolveMrFinalStatus,
  assertFollowUpStatusesComplete,
  archiveFollowUps,
  loadLevels,
  levelOf,
};
