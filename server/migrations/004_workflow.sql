-- ============================================================
-- Migration 004 : Workflow approval + mitigation history
-- (jalankan SETELAH 003 karena ada FK ke risk_registers)
-- ============================================================

USE `jxb_mr`;

-- ------------------------------------------------------------
-- Approval history (submit / approve / reject oleh Owner & MR)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `approval_histories` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `risk_register_id` INT UNSIGNED NOT NULL,
  `action`           ENUM(
                        'SUBMIT',
                        'APPROVE_OWNER',
                        'REJECT_OWNER',
                        'APPROVE_MR',
                        'REJECT_MR',
                        'ARCHIVE'
                      ) NOT NULL,
  `actor_id`         INT UNSIGNED NOT NULL,
  `actor_role`       ENUM('MR','RISK_OFFICER','RISK_OWNER') NOT NULL,
  `from_status`      VARCHAR(32) NOT NULL,
  `to_status`        VARCHAR(32) NOT NULL,
  `reason`           TEXT NULL,
  `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ah_register` (`risk_register_id`),
  KEY `idx_ah_created` (`created_at`),
  CONSTRAINT `fk_ah_register` FOREIGN KEY (`risk_register_id`)
    REFERENCES `risk_registers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ah_actor` FOREIGN KEY (`actor_id`)
    REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Mitigation history (versi treatment, tidak pernah overwrite)
-- snapshot : JSON seluruh section risk treatment per versi
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `risk_mitigation_histories` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `risk_register_id` INT UNSIGNED NOT NULL,
  `version`          INT UNSIGNED NOT NULL,
  `snapshot`         JSON NULL,
  `action`           ENUM(
                        'CREATE',
                        'SUBMIT',
                        'UPDATE_MITIGATION',
                        'APPROVE_OWNER',
                        'REJECT_OWNER',
                        'APPROVE_MR',
                        'REJECT_MR'
                      ) NOT NULL,
  `approval_status`  VARCHAR(32) NOT NULL,
  `rejection_reason` TEXT NULL,
  `created_by`       INT UNSIGNED NOT NULL,
  `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rmh_register_version` (`risk_register_id`,`version`),
  KEY `idx_rmh_created` (`created_at`),
  CONSTRAINT `fk_rmh_register` FOREIGN KEY (`risk_register_id`)
    REFERENCES `risk_registers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_rmh_creator` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- FK notifications -> risk_registers
-- Catatan: dijalankan satu kali (setelah 003).
-- ------------------------------------------------------------
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notif_register`
  FOREIGN KEY (`risk_register_id`) REFERENCES `risk_registers` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
