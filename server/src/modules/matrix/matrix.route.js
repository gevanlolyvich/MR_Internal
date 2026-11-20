const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middlewares/auth');
const { query } = require('../../db/pool');
const { getTolerance, getLevels } = require('../../utils/riskLevel');

router.get(
  '/',
  authenticate,
  authorize('matrix:view'),
  asyncHandler(async (req, res) => {
    const [likelihood] = await query('SELECT score, name, description FROM likelihood_master ORDER BY score ASC');
    const [impact] = await query('SELECT score, name, description FROM impact_master ORDER BY score ASC');
    const levels = await getLevels();
    const tolerance = await getTolerance();

    // Jumlah Risk Event per sel matrix (berdasar Risk After Mitigation)
    const [cells] = await query(
      `SELECT e.after_likelihood AS likelihood, e.after_impact AS impact, COUNT(*) AS total
         FROM risk_register_events e
         JOIN risk_register_categories c ON c.id = e.category_row_id
         JOIN risk_registers rr ON rr.id = c.risk_register_id
        GROUP BY e.after_likelihood, e.after_impact`
    );

    // Jumlah inherent per sel (untuk perbandingan)
    const [inherentCells] = await query(
      `SELECT e.inherent_likelihood AS likelihood, e.inherent_impact AS impact, COUNT(*) AS total
         FROM risk_register_events e
         JOIN risk_register_categories c ON c.id = e.category_row_id
         JOIN risk_registers rr ON rr.id = c.risk_register_id
        GROUP BY e.inherent_likelihood, e.inherent_impact`
    );

    const cellMap = {};
    cells.forEach((c) => {
      cellMap[`${c.likelihood}-${c.impact}`] = Number(c.total);
    });
    const inherentMap = {};
    inherentCells.forEach((c) => {
      inherentMap[`${c.likelihood}-${c.impact}`] = Number(c.total);
    });

    res.json({
      success: true,
      data: {
        likelihood,
        impact,
        levels,
        tolerance: { max_score: tolerance.max_score, note: tolerance.note },
        cells: cellMap,
        inherent_cells: inherentMap,
      },
    });
  })
);

module.exports = router;
