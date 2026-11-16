-- ============================================================
-- Migration 003 : Risk Register (struktur nested relational)
-- ============================================================

USE `jxb_mr`;

-- ------------------------------------------------------------
-- Counter kode risiko otomatis RISK-YYYY-NNNN
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `risk_code_counters` (
  `year`     SMALLINT UNSIGNED NOT NULL,
  `last_seq` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Risk Register (header: objective, owner, officer, branch, status)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `risk_registers` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `risk_code`        VARCHAR(20) NOT NULL,
  `year`             SMALLINT UNSIGNED NOT NULL,
  `branch_id`        INT UNSIGNED NOT NULL,
  `risk_officer_id`  INT UNSIGNED NOT NULL,
  `risk_owner_id`    INT UNSIGNED NOT NULL,
  `objective`        TEXT NOT NULL,
  `status`           ENUM(
                        'DRAFT',
                        'WAITING_OWNER_APPROVAL',
                        'REJECTED_BY_OWNER',
                        'WAITING_MR_APPROVAL',
                        'REJECTED_BY_MR',
                        'APPROVED',
                        'ARCHIVED'
                      ) NOT NULL DEFAULT 'DRAFT',
  `current_version`  INT UNSIGNED NOT NULL DEFAULT 1,
  `submitted_at`     TIMESTAMP NULL,
  `approved_at`      TIMESTAMP NULL,
  `created_by`       INT UNSIGNED NOT NULL,
  `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_risk_registers_code` (`risk_code`),
  KEY `idx_rr_status` (`status`),
  KEY `idx_rr_branch_year` (`branch_id`,`year`),
  KEY `idx_rr_owner_status` (`risk_owner_id`,`status`),
  KEY `idx_rr_officer` (`risk_officer_id`,`status`),
  KEY `idx_rr_year` (`year`),
  CONSTRAINT `fk_rr_branch` FOREIGN KEY (`branch_id`)
    REFERENCES `branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_rr_officer` FOREIGN KEY (`risk_officer_id`)
    REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_rr_owner` FOREIGN KEY (`risk_owner_id`)
    REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_rr_creator` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Objective 1 -> banyak Risk Category
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `risk_register_categories` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `risk_register_id` INT UNSIGNED NOT NULL,
  `category_id`   INT UNSIGNED NOT NULL,
  `sort_order`    INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_rrc_register` (`risk_register_id`),
  KEY `idx_rrc_category` (`category_id`),
  CONSTRAINT `fk_rrc_register` FOREIGN KEY (`risk_register_id`)
    REFERENCES `risk_registers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_rrc_category` FOREIGN KEY (`category_id`)
    REFERENCES `risk_categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Risk Category -> banyak Risk Event
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `risk_register_events` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_row_id` INT UNSIGNED NOT NULL,
  `name`          TEXT NOT NULL,
  `sort_order`    INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_rre_category_row` (`category_row_id`),
  CONSTRAINT `fk_rre_category_row` FOREIGN KEY (`category_row_id`)
    REFERENCES `risk_register_categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Risk Event -> banyak Risk Cause
-- Menyimpan seluruh assessment, control, treatment, risk after mitigation
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `risk_register_causes` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_row_id`  INT UNSIGNED NOT NULL,
  `name`          TEXT NOT NULL,
  `sort_order`    INT UNSIGNED NOT NULL DEFAULT 0,

  -- Sumber risiko & Severity
  `source_id`     INT UNSIGNED NULL,
  `severity_id`   INT UNSIGNED NULL,
  `severity_description` VARCHAR(255) NULL,
  `rp_amount`     DECIMAL(18,2) NULL,

  -- Inherent Risk
  `inherent_likelihood` TINYINT UNSIGNED NOT NULL,
  `inherent_impact`     TINYINT UNSIGNED NOT NULL,
  `inherent_score`      TINYINT UNSIGNED NOT NULL,

  -- Existing Control
  `control_present`         ENUM('ADA','TIDAK_ADA') NOT NULL DEFAULT 'TIDAK_ADA',
  `control_adequacy`        ENUM('MEMADAI','BELUM_MEMADAI') NOT NULL DEFAULT 'BELUM_MEMADAI',
  `control_implementation_pct` TINYINT UNSIGNED NOT NULL DEFAULT 0,

  -- Residual Risk
  `residual_likelihood` TINYINT UNSIGNED NOT NULL,
  `residual_impact`     TINYINT UNSIGNED NOT NULL,
  `residual_score`      TINYINT UNSIGNED NOT NULL,

  -- Risk Treatment
  `treatment_id`          INT UNSIGNED NULL,
  `mitigation_description` TEXT NULL,

  -- Risk After Mitigation
  `after_likelihood` TINYINT UNSIGNED NOT NULL,
  `after_impact`     TINYINT UNSIGNED NOT NULL,
  `after_score`      TINYINT UNSIGNED NOT NULL,

  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rrca_event_row` (`event_row_id`),
  KEY `idx_rrca_source` (`source_id`),
  KEY `idx_rrca_severity` (`severity_id`),
  KEY `idx_rrca_treatment` (`treatment_id`),
  KEY `idx_rrca_scores` (`inherent_score`,`residual_score`,`after_score`),
  CONSTRAINT `fk_rrca_event_row` FOREIGN KEY (`event_row_id`)
    REFERENCES `risk_register_events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_rrca_source` FOREIGN KEY (`source_id`)
    REFERENCES `risk_sources` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_rrca_severity` FOREIGN KEY (`severity_id`)
    REFERENCES `severity_levels` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_rrca_treatment` FOREIGN KEY (`treatment_id`)
    REFERENCES `risk_treatments` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
