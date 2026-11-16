-- ============================================================
-- Migration 002 : Master data
-- ============================================================

USE `jxb_mr`;

-- ------------------------------------------------------------
-- Risk Category
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `risk_categories` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code`        VARCHAR(16)  NOT NULL,
  `name`        VARCHAR(150) NOT NULL,
  `description` VARCHAR(255) NULL,
  `status`      ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_risk_categories_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Risk Treatment
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `risk_treatments` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code`        VARCHAR(16)  NOT NULL,
  `name`        VARCHAR(150) NOT NULL,
  `description` VARCHAR(255) NULL,
  `status`      ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_risk_treatments_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Likelihood (1-5)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `likelihood_master` (
  `score`       TINYINT UNSIGNED NOT NULL,
  `name`        VARCHAR(64) NOT NULL,
  `description` VARCHAR(255) NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Impact (1-5)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `impact_master` (
  `score`       TINYINT UNSIGNED NOT NULL,
  `name`        VARCHAR(64) NOT NULL,
  `description` VARCHAR(255) NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Risk Level (threshold dapat diubah oleh MR)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `risk_level_master` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `min_score`  TINYINT UNSIGNED NOT NULL,
  `max_score`  TINYINT UNSIGNED NOT NULL,
  `level`      VARCHAR(32) NOT NULL,
  `color`      VARCHAR(16) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_risk_level_range` (`min_score`,`max_score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Risk Source
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `risk_sources` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code`       VARCHAR(16) NOT NULL,
  `name`       VARCHAR(150) NOT NULL,
  `status`     ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_risk_sources_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Severity
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `severity_levels` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `score`       TINYINT UNSIGNED NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `rp_value`    DECIMAL(18,2) NULL,
  `status`      ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_severity_score` (`score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Risk Tolerance (konfigurasi matrix, 1 baris)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `risk_tolerance_config` (
  `id`         TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `max_score`  TINYINT UNSIGNED NOT NULL DEFAULT 9,
  `note`       VARCHAR(255) NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
