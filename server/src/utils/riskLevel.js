const { query } = require('../db/pool');

let cache = null;
const TTL_MS = 60 * 1000;

/**
 * Ambil konfigurasi risk level dari master data (dengan cache 60 detik).
 * @returns [{min_score, max_score, level, color}]
 */
const getLevels = async () => {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const [rows] = await query(
    'SELECT min_score, max_score, level, color FROM risk_level_master ORDER BY min_score ASC'
  );
  cache = { at: Date.now(), data: rows };
  return rows;
};

const invalidateLevelCache = () => {
  cache = null;
};

/** Score = Likelihood x Impact (aturan #38) */
const calcScore = (likelihood, impact) => Number(likelihood) * Number(impact);

/**
 * Tentukan level risk dari skor berdasar risk_level_master.
 * @returns {score, level, color}
 */
const getLevelByScore = async (score) => {
  const levels = await getLevels();
  const found = levels.find((l) => score >= l.min_score && score <= l.max_score);
  if (found) return { score, level: found.level, color: found.color };
  return { score, level: 'Tidak Diketahui', color: '#94a3b8' };
};

/** Risk Tolerance: score <= max_score => within */
const getTolerance = async () => {
  const [rows] = await query('SELECT max_score, note FROM risk_tolerance_config WHERE id = 1');
  const cfg = rows[0] || { max_score: 9, note: null };
  return cfg;
};

const toleranceStatus = (score, maxScore) =>
  Number(score) <= Number(maxScore) ? 'Within Risk Tolerance' : 'Exceeds Risk Tolerance';

module.exports = { calcScore, getLevelByScore, getLevels, invalidateLevelCache, getTolerance, toleranceStatus };
