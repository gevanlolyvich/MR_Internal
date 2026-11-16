const { query, withTransaction } = require('../../db/pool');

const SCORE_SUB = {
  inherent: `(SELECT MAX(cs.inherent_score) FROM risk_register_categories c
        JOIN risk_register_events e ON e.category_row_id = c.id
        JOIN risk_register_causes cs ON cs.event_row_id = e.id
       WHERE c.risk_register_id = rr.id)`,
  residual: `(SELECT MAX(cs.residual_score) FROM risk_register_categories c
        JOIN risk_register_events e ON e.category_row_id = c.id
        JOIN risk_register_causes cs ON cs.event_row_id = e.id
       WHERE c.risk_register_id = rr.id)`,
  after: `(SELECT MAX(cs.after_score) FROM risk_register_categories c
        JOIN risk_register_events e ON e.category_row_id = c.id
        JOIN risk_register_causes cs ON cs.event_row_id = e.id
       WHERE c.risk_register_id = rr.id)`,
};

/**
 * Daftar Risk Register dengan filter + agregasi skor per register.
 * scope: { role, userId } — MR all, Officer miliknya, Owner miliknya (read-only).
 */
const findList = async (filters = {}, scope = {}, pagination = {}) => {
  const where = [];
  const params = [];

  // --- Scope akses ---
  if (scope.role === 'RISK_OFFICER') {
    where.push('rr.risk_officer_id = ?');
    params.push(scope.userId);
  } else if (scope.role === 'RISK_OWNER') {
    where.push('rr.risk_owner_id = ?');
    params.push(scope.userId);
  }

  // --- Filter ---
  if (filters.year) {
    where.push('rr.year = ?');
    params.push(filters.year);
  }
  if (filters.branch) {
    where.push('rr.branch_id = ?');
    params.push(filters.branch);
  }
  if (filters.status) {
    where.push('rr.status = ?');
    params.push(filters.status);
  }
  if (filters.owner) {
    where.push('rr.risk_owner_id = ?');
    params.push(filters.owner);
  }
  if (filters.officer) {
    where.push('rr.risk_officer_id = ?');
    params.push(filters.officer);
  }
  if (filters.category) {
    where.push(
      `EXISTS (SELECT 1 FROM risk_register_categories c2
                WHERE c2.risk_register_id = rr.id AND c2.category_id = ?)`
    );
    params.push(filters.category);
  }
  if (filters.level) {
    // Level memakai Risk After Mitigation (skor akhir)
    where.push(
      `EXISTS (SELECT 1 FROM risk_level_master lm
                WHERE lm.level = ?
                  AND ${SCORE_SUB.after} BETWEEN lm.min_score AND lm.max_score)`
    );
    params.push(filters.level);
  }
  if (filters.q) {
    where.push(
      `(rr.risk_code LIKE ? OR rr.objective LIKE ?
        OR EXISTS (SELECT 1 FROM risk_register_categories c3
                     JOIN risk_register_events e3 ON e3.category_row_id = c3.id
                    WHERE c3.risk_register_id = rr.id AND e3.name LIKE ?))`
    );
    params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
  }

  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const [countRows] = await query(
    `SELECT COUNT(DISTINCT rr.id) AS total FROM risk_registers rr${whereSql}`,
    params
  );
  const total = Number(countRows[0].total);

  const limit = pagination.limit || 15;
  const offset = pagination.offset || 0;

  const [rows] = await query(
    `SELECT rr.id, rr.risk_code, rr.year, rr.objective, rr.status, rr.current_version,
            rr.created_at, rr.updated_at, rr.submitted_at, rr.approved_at,
            rr.branch_id, rr.risk_officer_id, rr.risk_owner_id,
            b.name AS branch_name,
            ow.name AS owner_name, ow.username AS owner_username,
            of.name AS officer_name, of.username AS officer_username,
            ${SCORE_SUB.inherent} AS inherent_score,
            ${SCORE_SUB.residual} AS residual_score,
            ${SCORE_SUB.after} AS after_score,
            (SELECT GROUP_CONCAT(DISTINCT rc.name ORDER BY rc.name SEPARATOR ', ')
               FROM risk_register_categories c
               JOIN risk_categories rc ON rc.id = c.category_id
              WHERE c.risk_register_id = rr.id) AS category_names,
            (SELECT COUNT(*) FROM risk_register_categories c
               JOIN risk_register_events e ON e.category_row_id = c.id
               JOIN risk_register_causes cs ON cs.event_row_id = e.id
              WHERE c.risk_register_id = rr.id) AS cause_count
       FROM risk_registers rr
       JOIN branches b ON b.id = rr.branch_id
       JOIN users ow ON ow.id = rr.risk_owner_id
       JOIN users of ON of.id = rr.risk_officer_id
      ${whereSql}
      ORDER BY rr.updated_at DESC, rr.id DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  return { rows, total };
};

/** Header register + nama relasi */
/** conn opsional: gunakan saat dibaca di dalam transaksi (baca write sendiri) */
const findHeader = async (id, conn = null) => {
  const runner = conn || { query };
  const [rows] = await runner.query(
    `SELECT rr.*, b.name AS branch_name, b.code AS branch_code,
            ow.name AS owner_name, ow.username AS owner_username, ow.email AS owner_email, ow.branch_id AS owner_branch_id,
            of.name AS officer_name, of.username AS officer_username, of.email AS officer_email, of.branch_id AS officer_branch_id
       FROM risk_registers rr
       JOIN branches b ON b.id = rr.branch_id
       JOIN users ow ON ow.id = rr.risk_owner_id
       JOIN users of ON of.id = rr.risk_officer_id
      WHERE rr.id = ?`,
    [id]
  );
  return rows[0] || null;
};

/** Nested lengkap: category -> event -> cause (dengan label master). conn opsional di dalam transaksi */
const findNested = async (id, conn = null) => {
  const runner = conn || { query };
  const [cats] = await runner.query(
    `SELECT c.id, c.category_id, c.sort_order, rc.code AS category_code, rc.name AS category_name
       FROM risk_register_categories c
       JOIN risk_categories rc ON rc.id = c.category_id
      WHERE c.risk_register_id = ?
      ORDER BY c.sort_order ASC, c.id ASC`,
    [id]
  );

  if (!cats.length) return [];

  const catIds = cats.map((c) => c.id);
  const [events] = await runner.query(
    `SELECT e.id, e.category_row_id, e.name, e.sort_order
       FROM risk_register_events e
      WHERE e.category_row_id IN (${catIds.map(() => '?').join(',')})
      ORDER BY e.sort_order ASC, e.id ASC`,
    catIds
  );

  let causes = [];
  if (events.length) {
    const evIds = events.map((e) => e.id);
    [causes] = await runner.query(
      `SELECT cs.*,
              rs.code AS source_code, rs.name AS source_name,
              sl.description AS severity_label, sl.score AS severity_score, sl.rp_value AS severity_rp,
              tr.code AS treatment_code, tr.name AS treatment_name
         FROM risk_register_causes cs
         LEFT JOIN risk_sources rs ON rs.id = cs.source_id
         LEFT JOIN severity_levels sl ON sl.id = cs.severity_id
         LEFT JOIN risk_treatments tr ON tr.id = cs.treatment_id
        WHERE cs.event_row_id IN (${evIds.map(() => '?').join(',')})
        ORDER BY cs.sort_order ASC, cs.id ASC`,
      evIds
    );
  }

  return cats.map((cat) => ({
    ...cat,
    events: events
      .filter((e) => e.category_row_id === cat.id)
      .map((ev) => ({
        ...ev,
        causes: causes.filter((c) => c.event_row_id === ev.id),
      })),
  }));
};

/** Insert header + nested dalam satu transaksi (conn sudah dalam transaction) */
const insertRegister = async (conn, header) => {
  const [result] = await conn.query(
    `INSERT INTO risk_registers
       (risk_code, year, branch_id, risk_officer_id, risk_owner_id, objective, status, current_version, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      header.risk_code,
      header.year,
      header.branch_id,
      header.risk_officer_id,
      header.risk_owner_id,
      header.objective,
      header.status,
      header.created_by,
    ]
  );
  return result.insertId;
};

/** Ganti seluruh isi nested (delete + insert) — dipakai saat update */
const replaceNested = async (conn, registerId, categories) => {
  await conn.query('DELETE FROM risk_register_categories WHERE risk_register_id = ?', [registerId]);

  let order = 0;
  for (const cat of categories) {
    const [catRes] = await conn.query(
      'INSERT INTO risk_register_categories (risk_register_id, category_id, sort_order) VALUES (?, ?, ?)',
      [registerId, cat.category_id, order++]
    );
    const categoryRowId = catRes.insertId;

    let evOrder = 0;
    for (const ev of cat.events || []) {
      const [evRes] = await conn.query(
        'INSERT INTO risk_register_events (category_row_id, name, sort_order) VALUES (?, ?, ?)',
        [categoryRowId, ev.name, evOrder++]
      );
      const eventRowId = evRes.insertId;

      let csOrder = 0;
      for (const cs of ev.causes || []) {
        await conn.query(
          `INSERT INTO risk_register_causes
             (event_row_id, name, sort_order, source_id, severity_id, severity_description, rp_amount,
              inherent_likelihood, inherent_impact, inherent_score,
              control_present, control_adequacy, control_implementation_pct,
              residual_likelihood, residual_impact, residual_score,
              treatment_id, mitigation_description,
              after_likelihood, after_impact, after_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            eventRowId,
            cs.name,
            csOrder++,
            cs.source_id ?? null,
            cs.severity_id ?? null,
            cs.severity_description ?? null,
            cs.rp_amount ?? null,
            cs.inherent_likelihood,
            cs.inherent_impact,
            cs.inherent_score,
            cs.control_present,
            cs.control_adequacy,
            cs.control_implementation_pct,
            cs.residual_likelihood,
            cs.residual_impact,
            cs.residual_score,
            cs.treatment_id ?? null,
            cs.mitigation_description ?? null,
            cs.after_likelihood,
            cs.after_impact,
            cs.after_score,
          ]
        );
      }
    }
  }
};

/** Generate kode RISK-YYYY-NNNN (locked dalam transaksi) */
const nextRiskCode = async (conn, year) => {
  await conn.query(
    `INSERT INTO risk_code_counters (year, last_seq) VALUES (?, 1)
       ON DUPLICATE KEY UPDATE last_seq = last_seq + 1`,
    [year]
  );
  const [rows] = await conn.query('SELECT last_seq FROM risk_code_counters WHERE year = ?', [year]);
  const seq = String(rows[0].last_seq).padStart(4, '0');
  return `RISK-${year}-${seq}`;
};

const updateHeader = async (conn, id, fields) => {
  const keys = Object.keys(fields);
  if (!keys.length) return 0;
  const [result] = await conn.query(
    `UPDATE risk_registers SET ${keys.map((k) => `\`${k}\` = ?`).join(', ')} WHERE id = ?`,
    [...keys.map((k) => fields[k]), id]
  );
  return result.affectedRows;
};

/**
 * Update status optimistic: hanya berhasil jika status lama sesuai.
 * Mengembalikan affectedRows (0 = konflik / approval ganda).
 */
const updateStatusGuarded = async (conn, id, expectedStatus, newStatus, extra = {}) => {
  const extraKeys = Object.keys(extra);
  const setSql = [`status = ?`, ...extraKeys.map((k) => `\`${k}\` = ?`)];
  const [result] = await conn.query(
    `UPDATE risk_registers SET ${setSql.join(', ')} WHERE id = ? AND status = ?`,
    [newStatus, ...extraKeys.map((k) => extra[k]), id, expectedStatus]
  );
  return result.affectedRows;
};

const insertApprovalHistory = async (conn, row) => {
  const [result] = await conn.query(
    `INSERT INTO approval_histories
       (risk_register_id, action, actor_id, actor_role, from_status, to_status, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [row.risk_register_id, row.action, row.actor_id, row.actor_role, row.from_status, row.to_status, row.reason || null]
  );
  return result.insertId;
};

const insertMitigationHistory = async (conn, row) => {
  const [result] = await conn.query(
    `INSERT INTO risk_mitigation_histories
       (risk_register_id, version, snapshot, action, approval_status, rejection_reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.risk_register_id,
      row.version,
      row.snapshot ? JSON.stringify(row.snapshot) : null,
      row.action,
      row.approval_status,
      row.rejection_reason || null,
      row.created_by,
    ]
  );
  return result.insertId;
};

const findApprovals = async (id) => {
  const [rows] = await query(
    `SELECT a.*, u.name AS actor_name, u.username AS actor_username
       FROM approval_histories a
       JOIN users u ON u.id = a.actor_id
      WHERE a.risk_register_id = ?
      ORDER BY a.id ASC`,
    [id]
  );
  return rows;
};

const findMitigations = async (id) => {
  const [rows] = await query(
    `SELECT m.*, u.name AS creator_name
       FROM risk_mitigation_histories m
       JOIN users u ON u.id = m.created_by
      WHERE m.risk_register_id = ?
      ORDER BY m.version DESC`,
    [id]
  );
  return rows;
};

const findAuditForRegister = async (id) => {
  const [rows] = await query(
    `SELECT a.*, u.name AS user_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
      WHERE (a.entity = 'risk_registers' AND a.entity_id = ?)
         OR (a.entity = 'risk_register' AND a.entity_id = ?)
      ORDER BY a.id DESC`,
    [id, id]
  );
  return rows;
};

/** Owner aktif pada branch (validasi backend) */
const findValidOwner = async (ownerId, branchId) => {
  const [rows] = await query(
    `SELECT id FROM users
      WHERE id = ? AND role = 'RISK_OWNER' AND status = 'ACTIVE' AND branch_id = ?`,
    [ownerId, branchId]
  );
  return rows[0] || null;
};

const softDelete = async (id) => {
  const [result] = await query('DELETE FROM risk_registers WHERE id = ?', [id]);
  return result.affectedRows;
};

module.exports = {
  findList,
  findHeader,
  findNested,
  insertRegister,
  replaceNested,
  nextRiskCode,
  updateHeader,
  updateStatusGuarded,
  insertApprovalHistory,
  insertMitigationHistory,
  findApprovals,
  findMitigations,
  findAuditForRegister,
  findValidOwner,
  softDelete,
  withTransaction,
  SCORE_SUB,
};
