-- ============================================================
-- 000 RESET SKEMA LAMA (OPSIONAL — jalankan HANYA jika disetujui)
--
-- Database `jxb_mr` berisi skema lama (prisma) yang bentrok dengan
-- skema baru JXB Risk Management System:
--   users, risk_categories, notifications, audit_logs, dll.
--
-- File ini MENGHAPUS permanen seluruh tabel & data lama.
-- Jalankan di phpMyAdmin SETELAH Anda backup (Export) jika perlu:
--   phpMyAdmin -> pilih jxb_mr -> Export -> Quick/SQL -> Go
--
-- Setelah file ini, jalankan urutan normal:
--   001_core.sql -> 002_masters.sql -> 003_risk_register.sql
--   -> 004_workflow.sql -> seeds/001_seed.sql
-- ============================================================

USE `jxb_mr`;

SET FOREIGN_KEY_CHECKS = 0;

-- Tabel skema lama (daftar eksplisit, tanpa wildcard)
DROP TABLE IF EXISTS `_prisma_migrations`;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `mitigation_evidence`;
DROP TABLE IF EXISTS `mitigation_plans`;
DROP TABLE IF EXISTS `mitigation_updates`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `number_sequences`;
DROP TABLE IF EXISTS `organizational_units`;
DROP TABLE IF EXISTS `password_reset_tokens`;
DROP TABLE IF EXISTS `permissions`;
DROP TABLE IF EXISTS `review_comments`;
DROP TABLE IF EXISTS `risk_assessment_history`;
DROP TABLE IF EXISTS `risk_assessments`;
DROP TABLE IF EXISTS `risk_categories`;
DROP TABLE IF EXISTS `risk_levels`;
DROP TABLE IF EXISTS `risk_settings`;
DROP TABLE IF EXISTS `risks`;
DROP TABLE IF EXISTS `role_permissions`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `sessions`;
DROP TABLE IF EXISTS `user_roles`;
DROP TABLE IF EXISTS `user_unit_assignments`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `workflow_approvals`;
DROP TABLE IF EXISTS `workflow_histories`;

SET FOREIGN_KEY_CHECKS = 1;

-- Selesai. Lanjut ke 001_core.sql
