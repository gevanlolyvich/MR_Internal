const { query } = require('../../db/pool');
const { STATUS } = require('../../config/status');
const { ROLES } = require('../../config/roles');
const { getTolerance } = require('../../utils/riskLevel');

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

const scopeWhere = (user) => {
  if (user.role === ROLES.RISK_OFFICER) return ['rr.risk_officer_id = ?', [user.id]];
  if (user.role === ROLES.RISK_OWNER) return ['rr.risk_owner_id = ?', [user.id]];
  return ['', []];
};

const getDashboard = async (user) => {
  const [scopeSql, scopeParams] = scopeWhere(user);
  const where = scopeSql ? `WHERE ${scopeSql}` : '';
  const andWhere = scopeSql ? `AND ${scopeSql}` : '';

  const [totals] = await query(
    `SELECT
        COUNT(*) AS total_risk,
        SUM(rr.status = '${STATUS.APPROVED}') AS active_risk,
        SUM(rr.status = '${STATUS.WAITING_OWNER_APPROVAL}') AS waiting_owner,
        SUM(rr.status = '${STATUS.WAITING_MR_APPROVAL}') AS waiting_mr,
        SUM(rr.status IN ('${STATUS.REJECTED_BY_OWNER}','${STATUS.REJECTED_BY_MR}')) AS rejected_risk,
        SUM(rr.status = '${STATUS.DRAFT}') AS draft_risk
       FROM risk_registers rr ${where}`,
    scopeParams
  );

  // Distribusi level berdasarkan Risk After Mitigation
  const [levels] = await query(
    `SELECT lm.level, lm.color, COUNT(*) AS total
       FROM risk_level_master lm
       LEFT JOIN risk_registers rr
         ON ${SCORE_SUB.after} BETWEEN lm.min_score AND lm.max_score ${andWhere}
      GROUP BY lm.min_score, lm.level, lm.color
      ORDER BY lm.min_score ASC`,
    scopeParams
  );

  const levelMap = {};
  let high = 0;
  let extreme = 0;
  let moderate = 0;
  let low = 0;
  levels.forEach((l) => {
    levelMap[l.level] = Number(l.total);
    if (l.level === 'Tinggi') high = Number(l.total);
    if (l.level === 'Ekstrem') extreme = Number(l.total);
    if (l.level === 'Moderat') moderate = Number(l.total);
    if (l.level === 'Rendah') low = Number(l.total);
  });

  const [byCategory] = await query(
    `SELECT rc.name AS label, COUNT(DISTINCT rr.id) AS total
       FROM risk_registers rr
       JOIN risk_register_categories c ON c.risk_register_id = rr.id
       JOIN risk_categories rc ON rc.id = c.category_id
       ${scopeSql ? `WHERE ${scopeSql}` : ''}
      GROUP BY rc.id, rc.name
      ORDER BY total DESC`,
    scopeParams
  );

  const [byBranch] = await query(
    `SELECT b.name AS label, COUNT(DISTINCT rr.id) AS total
       FROM risk_registers rr
       JOIN branches b ON b.id = rr.branch_id
       ${where}
      GROUP BY b.id, b.name
      ORDER BY total DESC
      LIMIT 15`,
    scopeParams
  );

  const [byStatus] = await query(
    `SELECT rr.status AS label, COUNT(*) AS total
       FROM risk_registers rr
       ${where}
      GROUP BY rr.status`,
    scopeParams
  );

  const [byYear] = await query(
    `SELECT rr.year AS label, COUNT(*) AS total
       FROM risk_registers rr
       ${where}
      GROUP BY rr.year
      ORDER BY rr.year ASC`,
    scopeParams
  );

  const tolerance = await getTolerance();

  const [exceedRows] = await query(
    `SELECT COUNT(*) AS total
       FROM risk_registers rr
      ${scopeSql ? `WHERE ${scopeSql} AND` : 'WHERE'} ${SCORE_SUB.after} > ?`,
    [...scopeParams, tolerance.max_score]
  );
  const [withinRows] = await query(
    `SELECT COUNT(*) AS total
       FROM risk_registers rr
      ${scopeSql ? `WHERE ${scopeSql} AND` : 'WHERE'} ${SCORE_SUB.after} <= ?`,
    [...scopeParams, tolerance.max_score]
  );

  return {
    cards: {
      total_risk: Number(totals[0].total_risk),
      active_risk: Number(totals[0].active_risk || 0),
      waiting_owner: Number(totals[0].waiting_owner || 0),
      waiting_mr: Number(totals[0].waiting_mr || 0),
      rejected_risk: Number(totals[0].rejected_risk || 0),
      draft_risk: Number(totals[0].draft_risk || 0),
      high_risk: high,
      extreme_risk: extreme,
      moderate_risk: moderate,
      low_risk: low,
      within_tolerance: Number(withinRows[0].total),
      exceeds_tolerance: Number(exceedRows[0].total),
    },
    charts: {
      by_category: byCategory.map((r) => ({ label: r.label, value: Number(r.total) })),
      by_branch: byBranch.map((r) => ({ label: r.label, value: Number(r.total) })),
      by_level: levels.map((r) => ({ label: r.level, value: Number(r.total), color: r.color })),
      by_status: byStatus.map((r) => ({ label: r.label, value: Number(r.total) })),
      by_year: byYear.map((r) => ({ label: String(r.label), value: Number(r.total) })),
    },
    tolerance: { max_score: tolerance.max_score, note: tolerance.note },
  };
};

module.exports = { getDashboard, SCORE_SUB };
