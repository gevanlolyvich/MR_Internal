-- ============================================================
-- Seed data awal untuk testing (JXB Risk Management System)
-- Jalankan SETELAH migrasi 001-004.
-- Semua INSERT bersifat idempotent (INSERT IGNORE / ON DUPLICATE KEY).
-- Password user contoh : lihat kolom password_hash (hash bcrypt dari
--   environment SEED_PASSWORD, lihat MIGRATION.md).
-- ============================================================

USE `jxb_mr`;

-- ------------------------------------------------------------
-- Branch / Unit kerja
-- ------------------------------------------------------------
INSERT IGNORE INTO `branches` (`code`,`name`,`description`,`status`) VALUES
 ('DIR','Direksi','Direksi','ACTIVE'),
 ('SIA','Satuan Internal Audit (SIA)','Internal Audit','ACTIVE'),
 ('MR','Manajemen Risiko','Manajemen Risiko','ACTIVE'),
 ('SEC','Corporate Secretary','Corporate Secretary','ACTIVE'),
 ('PRC','Procurement','Procurement','ACTIVE'),
 ('HRD','HRD','Human Resources Development','ACTIVE'),
 ('AF','Accounting & Finance','Accounting & Finance','ACTIVE'),
 ('IT','IT','Information Technology','ACTIVE'),
 ('AST','Aset Management','Aset Management','ACTIVE'),
 ('HSSE','HSSE','Health Safety Security Environment','ACTIVE'),
 ('SPD','Strategy Planning & development','Strategy Planning & Development','ACTIVE'),
 ('TEN','Tenancy','Tenancy','ACTIVE'),
 ('CAT','Catering','Catering','ACTIVE'),
 ('MKT','Marketing','Marketing','ACTIVE'),
 ('FIL','Filming','Filming','ACTIVE'),
 ('PAR','Pariwisata','Pariwisata','ACTIVE'),
 ('PRM','Property Management','Property Management','ACTIVE'),
 ('TVH','Tavia Heritage Hotel','Tavia Heritage Hotel','ACTIVE'),
 ('TVR','Tavia Riverside Resort & Convention','Tavia Riverside Resort & Convention','ACTIVE'),
 ('TVT','The Tavia Rumahtabati','The Tavia Rumahtabati','ACTIVE'),
 ('DAS',"d'Arcici Hotel Sunter","d'Arcici Hotel Sunter",'ACTIVE'),
 ('DAC',"d'Arcici Cempaka Putih","d'Arcici Cempaka Putih",'ACTIVE'),
 ('C1C','C One Hotel Cempaka Putih','C One Hotel Cempaka Putih','ACTIVE'),
 ('C1P','C One Hotel Pulomas','C One Hotel Pulomas','ACTIVE');

-- ------------------------------------------------------------
-- Risk Category
-- ------------------------------------------------------------
INSERT IGNORE INTO `risk_categories` (`code`,`name`,`description`) VALUES
 ('RK-STG','Strategis','Risiko strategis'),
 ('RK-OPS','Operasional','Risiko operasional'),
 ('RK-KEU','Keuangan','Risiko keuangan'),
 ('RK-HKM','Kepatuhan/Hukum','Risiko kepatuhan dan hukum'),
 ('RK-REP','Reputasi','Risiko reputasi'),
 ('RK-TI','Teknologi Informasi','Risiko teknologi informasi'),
 ('RK-SDM','Sumber Daya Manusia','Risiko sumber daya manusia'),
 ('RK-KEG','Proyek/Kegiatan','Risiko proyek dan kegiatan'),
 ('RK-FRD','Fraud','Risiko fraud'),
 ('RK-LA','Legalitas Aset','Risiko legalitas aset'),
 ('RK-HSSE','HSSE','Risiko health, safety, security, environment'),
 ('RK-BA','Bencana Alam','Risiko bencana alam'),
 ('RK-CRW','Crowd','Risiko crowd');

-- ------------------------------------------------------------
-- Risk Treatment
-- ------------------------------------------------------------
INSERT IGNORE INTO `risk_treatments` (`code`,`name`,`description`) VALUES
 ('TR-RED','Reduce / Mengurangi','Mengurangi kemungkinan dan/atau dampak risiko'),
 ('TR-AVO','Avoid / Menghindari','Menghindari aktivitas yang menimbulkan risiko'),
 ('TR-TRA','Transfer / Berbagi','Mentransfer risiko pihak lain (asuransi, kontrak)'),
 ('TR-ACC','Accept / Menerima','Menerima risiko dengan pemantauan berkala');

-- ------------------------------------------------------------
-- Likelihood
-- ------------------------------------------------------------
INSERT IGNORE INTO `likelihood_master` (`score`,`name`,`description`) VALUES
 (1,'Jarang','Kemungkinan terjadi sangat kecil'),
 (2,'Kecil','Kemungkinan terjadi kecil'),
 (3,'Sedang','Kemungkinan terjadi cukup besar'),
 (4,'Besar','Kemungkinan terjadi besar'),
 (5,'Hampir Pasti','Hampir pasti terjadi');

-- ------------------------------------------------------------
-- Impact
-- ------------------------------------------------------------
INSERT IGNORE INTO `impact_master` (`score`,`name`,`description`) VALUES
 (1,'Tidak Signifikan','Dampak tidak signifikan'),
 (2,'Rendah','Dampak rendah'),
 (3,'Menengah','Dampak menengah'),
 (4,'Besar','Dampak besar'),
 (5,'Dahsyat','Dampak sangat dahsyat');

-- ------------------------------------------------------------
-- Risk Level (1-4 Rendah | 5-9 Moderat | 10-16 Tinggi | 17-25 Ekstrem)
-- ------------------------------------------------------------
INSERT IGNORE INTO `risk_level_master` (`min_score`,`max_score`,`level`,`color`) VALUES
 (1,4,'Rendah','#22c55e'),
 (5,9,'Moderat','#eab308'),
 (10,16,'Tinggi','#f97316'),
 (17,25,'Ekstrem','#dc2626');

-- ------------------------------------------------------------
-- Risk Source
-- ------------------------------------------------------------
INSERT IGNORE INTO `risk_sources` (`code`,`name`) VALUES
 ('INT','Internal'),
 ('EXT','External');

-- ------------------------------------------------------------
-- Severity
-- ------------------------------------------------------------
INSERT IGNORE INTO `severity_levels` (`score`,`description`,`rp_value`) VALUES
 (1,'Penurunan Profitabilitas',50000000),
 (2,'Kerugian moderat pada unit kerja',250000000),
 (3,'Kerugian signifikan',1000000000),
 (4,'Kerugian sangat besar',5000000000),
 (5,'Kerugian mengancam kelangsungan usaha',25000000000);

-- ------------------------------------------------------------
-- Risk Tolerance (maksimum skor dianggap Within Risk Tolerance)
-- ------------------------------------------------------------
INSERT IGNORE INTO `risk_tolerance_config` (`id`,`max_score`,`note`) VALUES
 (1,9,'Skor <= 9 dianggap Within Risk Tolerance');

-- ------------------------------------------------------------
-- User contoh (3 role)
-- GANTI password_hash bila Anda mengganti SEED_PASSWORD,
-- hash dihasilkan dari bcrypt (lihat MIGRATION.md).
-- ------------------------------------------------------------
INSERT IGNORE INTO `users` (`branch_id`,`name`,`username`,`email`,`password_hash`,`role`,`status`)
SELECT b.id,'Admin Manajemen Risiko','mr.admin','mr.admin@jxb.local',
       '$2a$10$nn61OTVOIpfUm1aCp/SmsuWTQ2izFpLrA0c5NQixAsuLR0jKi4dkK','MR','ACTIVE'
FROM `branches` b WHERE b.code='MR';

INSERT IGNORE INTO `users` (`branch_id`,`name`,`username`,`email`,`password_hash`,`role`,`status`)
SELECT b.id,'Risk Officer Cempaka','officer.cempaka','officer.cempaka@jxb.local',
       '$2a$10$nn61OTVOIpfUm1aCp/SmsuWTQ2izFpLrA0c5NQixAsuLR0jKi4dkK','RISK_OFFICER','ACTIVE'
FROM `branches` b WHERE b.code='C1C';

INSERT IGNORE INTO `users` (`branch_id`,`name`,`username`,`email`,`password_hash`,`role`,`status`)
SELECT b.id,'Risk Owner Cempaka 1','owner.cempaka1','owner.cempaka1@jxb.local',
       '$2a$10$nn61OTVOIpfUm1aCp/SmsuWTQ2izFpLrA0c5NQixAsuLR0jKi4dkK','RISK_OWNER','ACTIVE'
FROM `branches` b WHERE b.code='C1C';
