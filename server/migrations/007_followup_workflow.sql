-- ============================================================
-- Migration 007 : Alur tindak lanjut MR (fresh install)
-- (jalankan SETELAH 006)
--
-- DRAFT -> submit -> WAITING_OWNER_APPROVAL -> owner approve
--       -> WAITING_MR_INSTRUCTION -> instruksi MR per item mitigasi
--       -> WAITING_OFFICER_FOLLOWUP -> realisasi + bukti Officer
--       -> WAITING_MR_APPROVAL -> penilaian akhir MR per item
-- Semua item SELESAI -> APPROVED. Jika ada BELUM_MEMADAI atau
-- TIDAK_DAPAT_DITINDAKLANJUTI -> WAITING_OFFICER_FOLLOWUP dengan
-- realisasi/documents lama diarsipkan via MR_FINAL_RETURN.
-- Status follow-up: SELESAI ('Sesuai / Selesai'), BELUM_MEMADAI
-- ('Belum Sesuai'), TIDAK_DAPAT_DITINDAKLANJUTI ('Belum Ditindaklanjuti').
-- MR_FINAL / MR_FINAL_RETURN sudah ditambahkan di sini untuk instalasi
-- baru; migration 008 melakukan hal yang sama pada database existing.
-- ============================================================

USE `jxb_mr`;

-- Status baru:
--   WAITING_MR_INSTRUCTION   : Owner sudah menyetujui, MR memberi instruksi tindak lanjut
--   WAITING_OFFICER_FOLLOWUP : MR sudah memberi instruksi, Officer mengisi realisasi + bukti
-- WAITING_OWNER_APPROVAL dipakai untuk approval Owner sebelum instruksi MR,
-- dan WAITING_MR_APPROVAL dipakai untuk penilaian akhir MR per item.
ALTER TABLE `risk_registers`
  MODIFY COLUMN `status` ENUM(
    'DRAFT',
    'WAITING_OWNER_APPROVAL',
    'REJECTED_BY_OWNER',
    'WAITING_MR_APPROVAL',
    'REJECTED_BY_MR',
    'APPROVED',
    'ARCHIVED',
    'WAITING_MR_INSTRUCTION',
    'WAITING_OFFICER_FOLLOWUP'
  ) NOT NULL DEFAULT 'DRAFT';

-- Aksi baru pada approval & mitigation history, termasuk penilaian akhir MR.
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
