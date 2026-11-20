-- ============================================================
-- Migration 005 : Risk Register - assessment di level Risk Event
-- ============================================================
-- Perubahan:
--   1. Assessment (Inherent / Existing Control / Residual / Risk
--      Treatment / Risk After Mitigation) dipindah dari level Risk
--      Cause ke level Risk Event.
--   2. Risk Cause kini hanya menyimpan identifikasi + Akibat/Potensi
--      Kerugian (Deskripsi + Rp). Field Severity dihapus.

USE `jxb_mr`;

-- ------------------------------------------------------------
-- 1. Tambah kolom assessment di level Risk Event
-- ------------------------------------------------------------
ALTER TABLE `risk_register_events`
  ADD COLUMN `inherent_likelihood` TINYINT UNSIGNED NULL,
  ADD COLUMN `inherent_impact` TINYINT UNSIGNED NULL,
  ADD COLUMN `inherent_score` TINYINT UNSIGNED NULL,
  ADD COLUMN `control_present` ENUM('ADA','TIDAK_ADA') NULL,
  ADD COLUMN `control_adequacy` ENUM('MEMADAI','BELUM_MEMADAI') NULL,
  ADD COLUMN `control_implementation_pct` TINYINT UNSIGNED NULL,
  ADD COLUMN `residual_likelihood` TINYINT UNSIGNED NULL,
  ADD COLUMN `residual_impact` TINYINT UNSIGNED NULL,
  ADD COLUMN `residual_score` TINYINT UNSIGNED NULL,
  ADD COLUMN `after_likelihood` TINYINT UNSIGNED NULL,
  ADD COLUMN `after_impact` TINYINT UNSIGNED NULL,
  ADD COLUMN `after_score` TINYINT UNSIGNED NULL,
  ADD COLUMN `mitigation_items` LONGTEXT NULL;

-- ------------------------------------------------------------
-- 2. Risk Cause -> identifikasi + Akibat/Potensi Kerugian
--    (assessment/control/treatment/mitigation/after di level Event)
-- ------------------------------------------------------------
ALTER TABLE `risk_register_causes`
  DROP FOREIGN KEY `fk_rrca_severity`,
  DROP FOREIGN KEY `fk_rrca_treatment`,
  DROP INDEX `idx_rrca_severity`,
  DROP INDEX `idx_rrca_treatment`,
  DROP INDEX `idx_rrca_scores`,
  DROP COLUMN `severity_id`,
  DROP COLUMN `inherent_likelihood`,
  DROP COLUMN `inherent_impact`,
  DROP COLUMN `inherent_score`,
  DROP COLUMN `control_present`,
  DROP COLUMN `control_adequacy`,
  DROP COLUMN `control_implementation_pct`,
  DROP COLUMN `residual_likelihood`,
  DROP COLUMN `residual_impact`,
  DROP COLUMN `residual_score`,
  DROP COLUMN `treatment_id`,
  DROP COLUMN `mitigation_description`,
  DROP COLUMN `after_likelihood`,
  DROP COLUMN `after_impact`,
  DROP COLUMN `after_score`;
