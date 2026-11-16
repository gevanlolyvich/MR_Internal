# JXB Risk Management System

Aplikasi **Website Manajemen Risiko JXB** — Risk Register, approval berlapis (Risk Owner → MR), master data, user management, risk matrix, dashboard, monitoring, dan export Excel.

| Lapisan | Teknologi |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + Recharts |
| Backend | Node.js + Express (controller / service / repository / middleware / validation / route) |
| Database | MySQL/MariaDB (XAMPP) — nama database **`jxb_mr`** |

---

## 1. Project Structure

```text
jxb_mr_1/
├── plan.md                      # Analisa & rencana (dibaca sebelum coding)
├── README.md                    # Dokumen ini
├── server/                      # Backend Node.js
│   ├── migrations/              # SQL migrasi berurutan (jalankan manual)
│   │   ├── 000_reset_old.sql    # OPSIONAL: hapus skema lama yang bentrok
│   │   ├── 001_core.sql
│   │   ├── 002_masters.sql
│   │   ├── 003_risk_register.sql
│   │   └── 004_workflow.sql
│   ├── seeds/001_seed.sql       # Branch, master, user contoh
│   ├── MIGRATION.md             # Panduan menjalankan migrasi
│   ├── src/
│   │   ├── app.js / server.js
│   │   ├── config/              # env, status (enum), roles (permission matrix)
│   │   ├── db/pool.js           # koneksi + helper transaksi
│   │   ├── middlewares/         # auth (JWT), rbac, validate, audit, errorHandler
│   │   ├── utils/               # riskLevel (kalkulasi), notify, pagination
│   │   └── modules/             # auth, users, branches, masters,
│   │                            # risk-registers, approvals, dashboard, matrix,
│   │                            # monitoring, export, notifications, audit
│   └── tests/                   # unit + integration (Jest/Supertest)
└── client/                      # Frontend React (Vite)
    └── src/
        ├── api/                 # axios + intercept token
        ├── constants/           # status/role/level (sinkron backend)
        ├── contexts/            # AuthContext, ToastContext
        ├── layouts/             # Sidebar + Topbar + notifikasi
        ├── components/ui/       # Badge, Modal, ConfirmDialog, Card, Stepper...
        └── pages/               # Login, Dashboard, RiskRegister (list/form/detail),
                                 # Approval, User, Branch, Master, Matrix,
                                 # Monitoring, AuditTrail
```

---

## 2. Installation

Prasyarat: **XAMPP (MySQL/MariaDB)**, Node.js ≥ 18.

```bash
# 1. Backend
cd server
npm install
copy .env.example .env        # Windows; sesuaikan kredensial DB

# 2. Frontend
cd ../client
npm install
```

---

## 3. Environment Configuration

`server/.env` (salinan `.env.example`):

```env
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=jxb_mr
DB_USERNAME=root
DB_PASSWORD=

JWT_SECRET=ganti-dengan-string-acak-yang-panjang
JWT_EXPIRES_IN=8h

SEED_PASSWORD=Jxb@2026
```

Credential database **tidak pernah di-hardcode** di source code. Ganti `JWT_SECRET` dan `SEED_PASSWORD` untuk environment produksi.

---

## 4. Database Setup, Migration & Seeder

Database **`jxb_mr`** dijalankan **manual** lewat phpMyAdmin / mysql client (lihat `server/MIGRATION.md`):

```text
000_reset_old.sql   (OPSIONAL — hanya jika jxb_mr masih berisi skema lama yang bentrok)
001_core.sql
002_masters.sql
003_risk_register.sql
004_workflow.sql
seeds/001_seed.sql
```

Migrasi idempoten (`CREATE TABLE IF NOT EXISTS`, `INSERT IGNORE`) dan **tidak berisi DROP DATABASE / DELETE massal** kecuali `000_reset_old.sql` yang memerlukan persetujuan Anda.

### Akun seed

| Username | Role | Branch | Password |
|---|---|---|---|
| `mr.admin` | MR | Manajemen Risiko | `Jxb@2026` (sesuai `SEED_PASSWORD`) |
| `officer.cempaka` | Risk Officer | C One Hotel Cempaka Putih | sama |
| `owner.cempaka1` | Risk Owner | C One Hotel Cempaka Putih | sama |

Jika password diubah, generate hash baru:

```bash
cd server
npm run gen:hash -- "PasswordBaru"
UPDATE users SET password_hash='...' WHERE username='mr.admin';
```

---

## 5. Menjalankan Aplikasi

```bash
# Terminal 1 — backend (http://localhost:4000)
cd server
npm run dev          # nodemon

# Terminal 2 — frontend (http://localhost:5173)
cd client
npm run dev
```

Proxy Vite `/api → http://localhost:4000` sudah dikonfigurasi.

### Build production

```bash
cd client && npm run build     # hasil di client/dist
cd server && npm start         # API production
```

Serve `client/dist` dari web server (Nginx/Apache) dan set `CORS_ORIGIN` sesuai domain.

---

## 6. API (ringkas)

```text
POST   /api/auth/login                    # rate-limited
GET    /api/auth/me

GET    /api/users        POST /api/users   PUT /api/users/:id   DELETE /api/users/:id
GET    /api/branches     POST /api/branches PUT /api/branches/:id
GET    /api/branches/:id/owners            # dropdown owner terfilter branch

GET    /api/masters/:type                  # categories|treatments|likelihoods|impacts|
POST   /api/masters/:type                  # levels|sources|severities
PUT    /api/masters/:type/:id    DELETE /api/masters/:type/:id
GET|PUT /api/masters/tolerance             # Risk Tolerance matrix

GET    /api/risk-registers                 # filter: year, branch, category, owner,
POST   /api/risk-registers                 #   officer, level, status, q, page, limit
GET    /api/risk-registers/:id             # nested lengkap + agregat skor
PUT    /api/risk-registers/:id             # versi mitigasi baru (history utuh)
POST   /api/risk-registers/:id/submit
GET    /api/risk-registers/:id/history     # approvals + mitigations + audit
DELETE /api/risk-registers/:id             # hanya DRAFT
GET    /api/risk-registers/owners/me       # owner satu branch dengan officer

GET    /api/approvals                      # antrian (owner / MR)
GET    /api/approvals/:id
POST   /api/approvals/:id/approve
POST   /api/approvals/:id/reject           # { reason } wajib

GET    /api/dashboard
GET    /api/matrix
GET    /api/monitoring        GET /api/monitoring/summary
GET    /api/export/risk-register           # XLSX (MR)
GET    /api/notifications    POST /api/notifications/read-all
GET    /api/audit-logs
```

Semua response: `{ success, data, message?, details? }`. Error validasi `details = [{ field, message }]`.

---

## 7. Role & Permission

| Fitur | Risk Officer | Risk Owner | MR |
|---|:-:|:-:|:-:|
| Dashboard | ✔ (data sendiri) | ✔ (antriannya) | ✔ (semua) |
| Risk Register (list/detail) | miliknya | read-only | read-only |
| Create / Edit / Submit Risk Register | ✔ | ✖ | ✖ |
| Approval (approve/reject) | ✖ | ✔ (owner-nya) | ✔ (final) |
| User / Branch / Master Management | ✖ | ✖ | ✔ |
| Matrix / Monitoring / Export / Audit | ✖ | ✖ | ✔ |

Permission didefinisikan terpusat di `server/src/config/roles.js` dan divalidasi **backend** (middleware `authorize`) — route protection frontend saja tidak cukup.

---

## 8. Approval Workflow

```text
DRAFT ──Submit──► WAITING_OWNER_APPROVAL
                      │
       Owner Approve ─┼──► WAITING_MR_APPROVAL ──MR Approve──► APPROVED
       Owner Reject ──┼──► REJECTED_BY_OWNER                  │
                      │                        MR Reject ──► REJECTED_BY_MR
                      └──────── Risk Officer perbaiki ◄────────┘
                                    │ Submit ulang (versi mitigasi baru)
                                    └──► WAITING_OWNER_APPROVAL
```

- Reject **wajib** `reason` → tampil sebagai *Rejected By / Reason*.
- Approve ganda ditolak **409** (optimistic status guard dalam transaksi).
- Perbaikan mitigation membuat **versi baru** (`risk_mitigation_histories`) — versi lama tidak pernah dihapus.
- Notifikasi in-app dikirim ke pihak berikutnya.

---

## 9. Risk Register (aturan inti)

- **Satu form** berisi: Objective → Risk Category (n) → Risk Event (n) → Risk Cause (n) → Sumber/Severity → Inherent → Existing Control → Residual → Treatment → Risk After Mitigation.
- Kode otomatis `RISK-YYYY-NNNN` (counter ber-locks dalam transaksi) — user tidak menginput kode.
- **Score = Likelihood × Impact**; level dihitung dari `risk_level_master` (1–4 Rendah · 5–9 Moderat · 10–16 Tinggi · 17–25 Ekstrem) — dapat diubah MR via Master Data.
- Risk Owner **difilter & divalidasi** berdasarkan branch Risk Officer (frontend **dan** backend).
- Risk Tolerance (`max_score`) dikonfigurasi MR — indikator *Within/Exceeds*; **tidak** mengubah alur approval.
- Save/Update memakai **database transaction** — register tidak pernah tersimpan setengah.

---

## 10. Export Excel

Menu **Export Excel** (sidebar MR) atau tombol di halaman Risk Register:

- Header bertingkat (group merged: Risk Register / Inherent / Existing Control / Residual / Treatment / After Mitigation / PIC)
- Satu baris per **Risk Cause** dengan merge hierarki Objective → Category → Event
- Border, wrap text, warna level risk, column width, freeze pane, auto filter

---

## 11. Testing

```bash
cd server

npm run test:unit    # tanpa DB: permission matrix, status, kalkulasi 1×1/3×3/5×5, pagination
npm test             # integration: butuh jxb_mr sudah dimigrasi + seed
```

Cakupan integration test:

- **Authentication** — login MR / Officer / Owner, login invalid, akses tanpa token.
- **Authorization** — Officer ≠ approve, Owner ≠ edit/create, MR ≠ create register, MR ≠ approve sebagai owner, owner branch salah ditolak.
- **Risk calculation** — 1×1 → Rendah, 3×3 → Moderat, 5×5 → Ekstrem, score dihitung sistem (bukan input manual).
- **Workflow** — Draft → Owner → MR → APPROVED; approve ganda → 409; register APPROVED tidak editable.
- **Rejection & history** — reject tanpa alasan → 400; alasan tersimpan; versi mitigasi lama tetap ada (v1..v3); alur Owner reject → perbaikan → MR reject → perbaikan → APPROVED.
- **Scope** — Officer hanya miliknya, Owner hanya yang ditugaskan, MR semua.
- **Dashboard/Matrix/Monitoring/Export** — data nyata + file XLSX valid (`PK` signature).

---

## 12. Keamanan

- Password: **bcrypt hash** (tidak pernah plaintext di frontend/source)
- Autentikasi: **JWT** + role-based authorization backend
- Validasi input: express-validator + validasi bisnis di service
- Proteksi SQL injection (prepared statement), XSS (helmet + React escaping)
- Rate limiting login, CORS terkonfigurasi, password policy (min 8, huruf+angka)
- Audit trail menyimpan user/role/action/IP/old-new value — **tanpa** data sensitif
- Approval aman dari race condition (status guard + transaksi)
