const repo = require('./riskRegister.repository');
const ApiError = require('../../utils/ApiError');
const { STATUS, EDITABLE_STATUS } = require('../../config/status');
const { calcScore, getLevelByScore } = require('../../utils/riskLevel');
const { query, withTransaction } = require('../../db/pool');
const { audit } = require('../../middlewares/audit');
const { notify } = require('../../utils/notify');
const { ROLES } = require('../../config/roles');

const L_I_RANGE = [1, 2, 3, 4, 5];
const CONTROL_PRESENT = ['ADA', 'TIDAK_ADA'];
const CONTROL_ADEQUACY = ['MEMADAI', 'BELUM_MEMADAI'];

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

/** Ambil semua level dari master untuk kalkulasi */
const loadLevels = async () => {
  const [rows] = await query('SELECT min_score, max_score, level, color FROM risk_level_master ORDER BY min_score ASC');
  return rows;
};

const levelOf = (score, levels) => {
  const found = levels.find((l) => score >= l.min_score && score <= l.max_score);
  return { level: found ? found.level : 'Tidak Diketahui', color: found ? found.color : '#94a3b8' };
};

/**
 * Validasi payload Risk Register (frontend + backend).
 * @returns { errors: [{field,message}], data: normalized }
 */
const validatePayload = async (payload, user) => {
  const errors = [];
  const push = (field, message) => errors.push({ field, message });

  if (!isNonEmptyString(payload.objective)) push('objective', 'Objective wajib diisi');

  // Branch = branch Risk Officer (rule #26), owner harus satu branch
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

        // Severity (opsional, tapi jika diisi harus valid)
        if (cs.severity_id !== undefined && cs.severity_id !== null && cs.severity_id !== '') {
          if (!Number.isInteger(Number(cs.severity_id))) push(`${p}.severity_id`, 'Severity tidak valid');
        }
        if (cs.rp_amount !== undefined && cs.rp_amount !== null && cs.rp_amount !== '') {
          if (Number(cs.rp_amount) < 0) push(`${p}.rp_amount`, 'Nilai Rp tidak boleh negatif');
        }

        // Inherent
        const inhL = Number(cs.inherent && cs.inherent.likelihood);
        const inhI = Number(cs.inherent && cs.inherent.impact);
        if (!L_I_RANGE.includes(inhL)) push(`${p}.inherent.likelihood`, 'Inherent Likelihood wajib 1-5');
        if (!L_I_RANGE.includes(inhI)) push(`${p}.inherent.impact`, 'Inherent Impact wajib 1-5');

        // Existing control
        const control = cs.control || {};
        if (!CONTROL_PRESENT.includes(control.present)) push(`${p}.control.present`, 'Existing Control (Ada/Tidak Ada) wajib dipilih');
        if (!CONTROL_ADEQUACY.includes(control.adequacy)) push(`${p}.control.adequacy`, 'Control Adequacy wajib dipilih');
        const pct = Number(control.implementation);
        if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
          push(`${p}.control.implementation`, 'Dijalankan (%) harus bilangan 0-100');
        }

        // Residual
        const resL = Number(cs.residual && cs.residual.likelihood);
        const resI = Number(cs.residual && cs.residual.impact);
        if (!L_I_RANGE.includes(resL)) push(`${p}.residual.likelihood`, 'Residual Likelihood wajib 1-5');
        if (!L_I_RANGE.includes(resI)) push(`${p}.residual.impact`, 'Residual Impact wajib 1-5');

        // Treatment
        if (!cs.treatment_id) push(`${p}.treatment_id`, 'Opsi Perlakuan Risiko wajib dipilih');
        if (!isNonEmptyString(cs.mitigation_description)) push(`${p}.mitigation_description`, 'Deskripsi Tindakan Mitigasi wajib diisi');

        // Risk after mitigation
        const aftL = Number(cs.after && cs.after.likelihood);
        const aftI = Number(cs.after && cs.after.impact);
        if (!L_I_RANGE.includes(aftL)) push(`${p}.after.likelihood`, 'Risk After Mitigation Likelihood wajib 1-5');
        if (!L_I_RANGE.includes(aftI)) push(`${p}.after.impact`, 'Risk After Mitigation Impact wajib 1-5');

        const hasError = errors.some((e) => e.field.startsWith(p) || e.field.startsWith(ePrefix) || e.field.startsWith(cPrefix));
        if (!hasError) {
          const inherent_score = calcScore(inhL, inhI);
          const residual_score = calcScore(resL, resI);
          const after_score = calcScore(aftL, aftI);
          normalized.push({
            category_id: Number(cat.category_id),
            name: cs.name.trim(),
            source_id: cs.source_id ? Number(cs.source_id) : null,
            severity_id: cs.severity_id ? Number(cs.severity_id) : null,
            severity_description: cs.severity_description || null,
            rp_amount: cs.rp_amount === '' || cs.rp_amount === null || cs.rp_amount === undefined ? null : Number(cs.rp_amount),
            inherent: { likelihood: inhL, impact: inhI, score: inherent_score, ...levelOf(inherent_score, levels) },
            control: {
              present: control.present,
              adequacy: control.adequacy,
              implementation: pct,
            },
            residual: { likelihood: resL, impact: resI, score: residual_score, ...levelOf(residual_score, levels) },
            treatment_id: Number(cs.treatment_id),
            mitigation_description: cs.mitigation_description.trim(),
            after: { likelihood: aftL, impact: aftI, score: after_score, ...levelOf(after_score, levels) },
            _event: { name: ev.name.trim() },
            _category: Number(cat.category_id),
          });
        }
      });
    });
  });

  return { errors, normalized, branchId, levels };
};

/** Susun ulang normalized -> struktur nested siap insert (format flat sesuai kolom DB) */
const buildNested = (normalized) => {
  const tree = [];
  normalized.forEach((item) => {
    let cat = tree.find((c) => c.category_id === item._category);
    if (!cat) {
      cat = { category_id: item._category, events: [] };
      tree.push(cat);
    }
    let ev = cat.events.find((e) => e.name === item._event.name);
    if (!ev) {
      ev = { name: item._event.name, causes: [] };
      cat.events.push(ev);
    }
    ev.causes.push({
      name: item.name,
      source_id: item.source_id,
      severity_id: item.severity_id,
      severity_description: item.severity_description,
      rp_amount: item.rp_amount,
      inherent_likelihood: item.inherent.likelihood,
      inherent_impact: item.inherent.impact,
      inherent_score: item.inherent.score,
      control_present: item.control.present,
      control_adequacy: item.control.adequacy,
      control_implementation_pct: item.control.implementation,
      residual_likelihood: item.residual.likelihood,
      residual_impact: item.residual.impact,
      residual_score: item.residual.score,
      treatment_id: item.treatment_id,
      mitigation_description: item.mitigation_description,
      after_likelihood: item.after.likelihood,
      after_impact: item.after.impact,
      after_score: item.after.score,
    });
  });
  return tree;
};

/** Snapshot ringkas section Risk Treatment untuk history */
const buildSnapshot = (header, nested) => ({
  objective: header.objective,
  risk_code: header.risk_code,
  generated_at: new Date().toISOString(),
  items: nested.flatMap((cat) =>
    cat.events.flatMap((ev) =>
      ev.causes.map((cs) => ({
        category: cat.category_name || cat.category_id,
        event: ev.name,
        cause: cs.name,
        treatment: cs.treatment_name || cs.treatment_code || cs.treatment_id,
        treatment_id: cs.treatment_id,
        mitigation_description: cs.mitigation_description,
        residual: { likelihood: cs.residual_likelihood, impact: cs.residual_impact, score: cs.residual_score },
        after: { likelihood: cs.after_likelihood, impact: cs.after_impact, score: cs.after_score },
      }))
    )
  ),
});

/** Validasi kelengkapan data tersimpan sebelum submit */
const assertComplete = (header, nested) => {
  const errors = [];
  if (!header || !isNonEmptyString(header.objective)) errors.push({ field: 'objective', message: 'Objective wajib diisi' });
  if (!header.risk_owner_id) errors.push({ field: 'risk_owner_id', message: 'Risk Owner wajib dipilih' });
  if (!nested.length) errors.push({ field: 'categories', message: 'Minimal 1 Risk Category wajib diisi' });

  nested.forEach((cat) => {
    if (!cat.events.length) errors.push({ field: 'events', message: 'Setiap kategori harus memiliki minimal 1 Risk Event' });
    cat.events.forEach((ev) => {
      if (!ev.causes.length) errors.push({ field: 'causes', message: 'Setiap event harus memiliki minimal 1 Risk Cause' });
      ev.causes.forEach((cs) => {
        if (!cs.treatment_id) errors.push({ field: 'treatment_id', message: 'Risk Treatment wajib pada setiap Risk Cause' });
        if (!cs.mitigation_description) errors.push({ field: 'mitigation_description', message: 'Deskripsi mitigasi wajib pada setiap Risk Cause' });
        if (![1, 2, 3, 4, 5].includes(Number(cs.inherent_likelihood)) || ![1, 2, 3, 4, 5].includes(Number(cs.inherent_impact))) {
          errors.push({ field: 'inherent', message: 'Inherent Risk belum lengkap' });
        }
      });
    });
  });

  if (errors.length) throw ApiError.badRequest('Risk Register belum lengkap', errors);
};

// ---------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------
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
    const createdNested = await repo.findNested(id, conn);

    await repo.insertMitigationHistory(conn, {
      risk_register_id: id,
      version: 1,
      snapshot: buildSnapshot(header, createdNested),
      action: 'CREATE',
      approval_status: STATUS.DRAFT,
      created_by: user.id,
    });
    return id;
  });

  audit({ req, action: 'CREATE_RISK_REGISTER', entity: 'risk_registers', entityId: registerId, newValue: { objective: payload.objective } });
  return getDetail(registerId, user);
};

// ---------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------
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

    // Versi mitigasi baru — data lama tidak pernah dihapus (tetap di history)
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

// ---------------------------------------------------------------
// SUBMIT -> WAITING_OWNER_APPROVAL
// ---------------------------------------------------------------
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

  await withTransaction(async (conn) => {
    const affected = await repo.updateStatusGuarded(conn, id, header.status, STATUS.WAITING_OWNER_APPROVAL, {
      submitted_at: new Date(),
    });
    if (!affected) throw ApiError.conflict('Status Risk Register telah berubah, muat ulang halaman');

    await repo.insertApprovalHistory(conn, {
      risk_register_id: id,
      action: 'SUBMIT',
      actor_id: user.id,
      actor_role: user.role,
      from_status: header.status,
      to_status: STATUS.WAITING_OWNER_APPROVAL,
    });

    // Update baris versi mitigasi terkini
    await conn.query(
      `UPDATE risk_mitigation_histories
          SET action = 'SUBMIT', approval_status = ?, rejection_reason = NULL
        WHERE risk_register_id = ? AND version = ?`,
      [STATUS.WAITING_OWNER_APPROVAL, id, header.current_version]
    );
  });

  await notify({
    userIds: [header.risk_owner_id],
    title: 'Risk Register menunggu approval',
    message: `${header.risk_code} membutuhkan approval Anda.`,
    riskRegisterId: id,
  });

  audit({ req, action: 'SUBMIT_RISK_REGISTER', entity: 'risk_registers', entityId: id, oldValue: { status: header.status }, newValue: { status: STATUS.WAITING_OWNER_APPROVAL } });
  return getDetail(id, user);
};

// ---------------------------------------------------------------
// READ
// ---------------------------------------------------------------
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

  const decorate = (likelihood, impact, score) => ({
    likelihood,
    impact,
    score,
    ...levelOf(Number(score), levels),
  });

  const nestedOut = nested.map((cat) => ({
    ...cat,
    events: cat.events.map((ev) => ({
      ...ev,
      causes: ev.causes.map((cs) => ({
        ...cs,
        inherent: decorate(cs.inherent_likelihood, cs.inherent_impact, cs.inherent_score),
        residual: decorate(cs.residual_likelihood, cs.residual_impact, cs.residual_score),
        after: decorate(cs.after_likelihood, cs.after_impact, cs.after_score),
      })),
    })),
  }));

  // Skor agregat per register (maksimum)
  const allScores = nestedOut.flatMap((c) => c.events.flatMap((e) => e.causes.map((x) => x)));
  const maxScore = (key) =>
    allScores.length ? Math.max(...allScores.map((x) => Number(x[key]))) : null;
  const inhMax = maxScore('inherent_score');
  const resMax = maxScore('residual_score');
  const aftMax = maxScore('after_score');

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

module.exports = {
  createRegister,
  updateRegister,
  submitRegister,
  getList,
  getDetail,
  getHistory,
  deleteRegister,
  loadLevels,
  levelOf,
};
