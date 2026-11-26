-- ============================================================
-- Migration 008 : Penilaian tindak lanjut MR + pengembalian item
-- (jalankan SETELAH 007)
-- ============================================================

USE `jxb_mr`;

-- MR_FINAL         : semua item dinilai MR (status SELESAI)
-- MR_FINAL_RETURN  : item dikembalikan ke Officer (BELUM_MEMADAI / TIDAK_DAPAT_DITINDAKLANJUTI)
ALTER TABLE `approval_histories`
  MODIFY COLUMN `action` ENUM(
    'SUBMIT',
    'APPROVE_OWNER',
    'REJECT_OWNER',
    'APPROVE_MR',
    'REJECT_MR',
    'ARCHIVE',
    'MR_INSTRUCTION',
    'OFFICER_REALIZATION',
    'REJECT_MR_INSTRUCTION',
    'MR_FINAL',
    'MR_FINAL_RETURN'
  ) NOT NULL;

ALTER TABLE `risk_mitigation_histories`
  MODIFY COLUMN `action` ENUM(
    'CREATE',
    'SUBMIT',
    'UPDATE_MITIGATION',
    'APPROVE_OWNER',
    'REJECT_OWNER',
    'APPROVE_MR',
    'REJECT_MR',
    'MR_INSTRUCTION',
    'OFFICER_REALIZATION',
    'REJECT_MR_INSTRUCTION',
    'MR_FINAL',
    'MR_FINAL_RETURN'
  ) NOT NULL;
