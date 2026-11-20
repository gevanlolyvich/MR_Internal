-- ============================================================
-- Migration 006 : Unit Kerja / Unit Usaha pada Risk Cause
-- ============================================================
-- Menambahkan kolom work_unit di level Risk Cause (tepat di
-- bawah data Severity: severity_description + rp_amount).
-- Item mitigasi (risk_register_events.mitigation_items, JSON)
-- ikut menyimpan "follow_up" tanpa perubahan skema.

USE `jxb_mr`;

ALTER TABLE `risk_register_causes`
  ADD COLUMN `work_unit` VARCHAR(150) NULL AFTER `rp_amount`;
