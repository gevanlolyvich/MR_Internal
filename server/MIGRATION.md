# Database Setup — JXB Risk Management System

Database: **`jxb_mr`** (MySQL/MariaDB via XAMPP).

Semua file SQL berada di `server/migrations/` dan `server/seeds/`.
Jalankan **secara manual dan berurutan** (phpMyAdmin → Import, atau mysql client).

## Urutan menjalankan

> **PENTING:** Jika `jxb_mr` masih berisi skema lama (prisma: users, risks,
> risk_assessments, workflow_approvals, ...) yang bentrok, jalankan dulu
> `migrations/000_reset_old.sql` (drop permanen — backup dulu lewat Export
> phpMyAdmin jika data lama masih diperlukan). File 000 disetujui pengguna.

| # | File | Isi |
|---|------|-----|
| 0 | `migrations/000_reset_old.sql` | **OPSIONAL** — hapus skema lama yang bentrok |
| 1 | `migrations/001_core.sql` | `CREATE DATABASE jxb_mr`, branches, users, audit_logs, notifications |
| 2 | `migrations/002_masters.sql` | master: category, treatment, likelihood, impact, risk level, source, severity, risk tolerance |
| 3 | `migrations/003_risk_register.sql` | risk_code_counters, risk_registers, risk_register_categories, risk_register_events, risk_register_causes |
| 4 | `migrations/004_workflow.sql` | approval_histories, risk_mitigation_histories, FK notifications → risk_registers |
| 5 | `migrations/005_risk_register_event_level.sql` | Assessment (Inherent/Control/Residual/Treatment/After) pindah ke level **Risk Event**; Severity dihapus dari Risk Cause |
| 6 | `migrations/006_cause_work_unit.sql` | Kolom `work_unit` (Unit Kerja / Unit Usaha) pada Risk Cause; Tindak Lanjut per item mitigasi (JSON) |
| 7 | `migrations/007_followup_workflow.sql` | Status baru `WAITING_MR_INSTRUCTION`, `WAITING_OFFICER_FOLLOWUP` dan aksi history instruksi/realisasi/penilaian MR (termasuk `MR_FINAL`, `MR_FINAL_RETURN`) |
| 8 | `migrations/008_mr_final_assessment.sql` | Menambahkan aksi `MR_FINAL` / `MR_FINAL_RETURN` pada tabel history untuk database yang sudah menjalankan 007 |
| 9 | `seeds/001_seed.sql` | branch, kategori risiko, treatment, likelihood, impact, risk level, source, severity, tolerance, 3 user contoh |

### via phpMyAdmin

1. Buka `http://localhost/phpmyadmin`
2. (Jika skema lama masih ada) Tab **Import** → `migrations/000_reset_old.sql` → **Go**
3. Tab **Import** → pilih file → **Go** → ulangi untuk file berikutnya sesuai urutan di atas.

### via mysql client (XAMPP)

```bash
# hanya jika perlu reset skema lama (lihat catatan di atas):
C:\xampp\mysql\bin\mysql -u root -p jxb_mr < server\migrations\000_reset_old.sql
C:\xampp\mysql\bin\mysql -u root -p jxb_mr < server\migrations\001_core.sql
C:\xampp\mysql\bin\mysql -u root -p jxb_mr < server\migrations\002_masters.sql
C:\xampp\mysql\bin\mysql -u root -p jxb_mr < server\migrations\003_risk_register.sql
C:\xampp\mysql\bin\mysql -u root -p jxb_mr < server\migrations\004_workflow.sql
C:\xampp\mysql\bin\mysql -u root -p jxb_mr < server\migrations\005_risk_register_event_level.sql
C:\xampp\mysql\bin\mysql -u root -p jxb_mr < server\migrations\006_cause_work_unit.sql
C:\xampp\mysql\bin\mysql -u root -p jxb_mr < server\migrations\007_followup_workflow.sql
C:\xampp\mysql\bin\mysql -u root -p jxb_mr < server\migrations\008_mr_final_assessment.sql
C:\xampp\mysql\bin\mysql -u root -p jxb_mr < server\seeds\001_seed.sql
```

> Catatan: file dibuat idempoten (`CREATE TABLE IF NOT EXISTS`, `INSERT IGNORE`)
> kecuali `ALTER TABLE ... ADD CONSTRAINT` di `004_workflow.sql` (jalankan sekali saja).

### Seed data Risk Register (opsional)

`005` **menghapus** kolom assessment lama di Risk Cause, jadi data register lama
tidak kompatibel. Untuk mengisi contoh data baru (12 register, status beragam):

```bash
cd server
node scripts/seed-risk-registers.js
```

Script ini menghapus register + counter kode terlebih dahulu, lalu membuat ulang
register dengan struktur event-level (inherent/control/residual/treatment/after
per event, severity_description + rp_amount + work_unit per cause, dan status
tindak lanjut per item mitigasi).

### Alur tindak lanjut

Status dan aksi history berjalan berurutan sebagai berikut:

1. Officer mengisi register (`DRAFT`) lalu submit → `WAITING_OWNER_APPROVAL` (`SUBMIT`).
2. Risk Owner menyetujui → `WAITING_MR_INSTRUCTION` (`APPROVE_OWNER`).
   Jika Owner mengembalikan → `REJECTED_BY_OWNER` (`REJECT_OWNER`), officer dapat mengedit lalu submit ulang.
3. MR memberi instruksi per item mitigasi → `WAITING_OFFICER_FOLLOWUP` (`MR_INSTRUCTION`).
   Keterangan MR wajib pada tahap instruksi.
4. Officer mengisi realisasi per item → `WAITING_MR_APPROVAL` (`OFFICER_REALIZATION`).
   Keterangan realisasi wajib; bukti dokumen diunggah pada tahap ini.
5. MR menilai setiap item pada `WAITING_MR_APPROVAL`:
   - `SELESAI` → tampil sebagai **Sesuai / Selesai**.
   - `BELUM_MEMADAI` → tampil sebagai **Belum Sesuai**.
   - `TIDAK_DAPAT_DITINDAKLANJUTI` → tampil sebagai **Belum Ditindaklanjuti**.

   Jika **semua** item `SELESAI` → `APPROVED` (`APPROVE_MR`; history item `MR_FINAL`).
   Jika **ada** item `BELUM_MEMADAI` atau `TIDAK_DAPAT_DITINDAKLANJUTI` →
   kembali ke `WAITING_OFFICER_FOLLOWUP` (`MR_FINAL_RETURN`). Realisasi dan
   dokumen lama diarsipkan ke `follow_up_history` sebelum officer mengisi ulang.

Status lama `REJECTED_BY_MR` tetap dikenali untuk data lama/tampilan, tetapi
bukan bagian dari set demo aktif. Nilai enum lama tidak dihapus.

### Bukti dokumen tindak lanjut

Fitur upload tidak memerlukan migrasi SQL. Jalankan once:

```bash
cd server
npm install
```

**Upload bukti hanya tersedia pada status `WAITING_OFFICER_FOLLOWUP`**
(setelah instruksi MR, saat officer menyiapkan realisasi). Tidak tersedia
field/endpoint upload pada `DRAFT` maupun form awal; server menolak upload
pada status lain. Bukti tetap melekat pada item saat status berubah ke
`WAITING_MR_APPROVAL` / `APPROVED`, dan ikut terarsip saat `MR_FINAL_RETURN`.

File disimpan di `server/uploads/risk-registers/<registerId>/` (diabaikan git)
dan hanya dapat diunduh melalui endpoint terautentikasi
`GET /api/risk-registers/:id/documents/:docId`. Format didukung: gambar
(JPG/JPEG/PNG/GIF/WebP/BMP), Excel (XLS/XLSX), PowerPoint (PPT/PPTX), PDF,
dan Word (DOC/DOCX). Maks 5 MB per file, maks 5 file per item mitigasi.

## Password user seed

Seed berisi hash bcrypt, **bukan plaintext**. Hash dibuat dari password pada
environment variable `SEED_PASSWORD` (lihat `server/.env.example`).

Jika Anda mengganti password, generate hash baru lalu update kolom
`password_hash` pada tabel `users`:

```bash
cd server
node -e "console.log(require('bcryptjs').hashSync('PASSWORD_ANDA', 10))"
```

```sql
UPDATE users SET password_hash='HASIL_HASH_BARU' WHERE username='mr.admin';
```

## Kredensial awal (seed)

| Username | Role | Branch |
|----------|------|--------|
| `mr.admin` | MR | Manajemen Risiko |
| `officer.cempaka` | Risk Officer | C One Hotel Cempaka Putih |
| `owner.cempaka1` | Risk Owner | C One Hotel Cempaka Putih |

Password: sesuai `SEED_PASSWORD` (default ada di `.env.example` — ganti untuk environment produksi).

## Tidak ada operasi destruktif

File migrasi tidak berisi `DROP DATABASE`, `DROP TABLE`, atau `DELETE` massal.
Untuk reset total, buat database baru dengan nama lain — **jangan** menjalankan drop tanpa persetujuan.
