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
| 5 | `seeds/001_seed.sql` | branch, kategori risiko, treatment, likelihood, impact, risk level, source, severity, tolerance, 3 user contoh |

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
C:\xampp\mysql\bin\mysql -u root -p jxb_mr < server\seeds\001_seed.sql
```

> Catatan: file dibuat idempoten (`CREATE TABLE IF NOT EXISTS`, `INSERT IGNORE`)
> kecuali `ALTER TABLE ... ADD CONSTRAINT` di `004_workflow.sql` (jalankan sekali saja).

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
