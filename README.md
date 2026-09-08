# SPP-Backend (Sistem Informasi Manajemen Keuangan Sekolah)

Backend RESTful API untuk sistem informasi manajemen keuangan dan administrasi pembayaran sekolah (SPP bulanan, fullday, uang pembangunan, seragam, peralatan, ekstrakurikuler, daftar ulang / PPDB, dan pencatatan kas/transaksi) multi-unit sekolah (KB, RA, SD) berbasis role dan terintegrasi dengan payment gateway online.

Arsitektur sistem ini dibangun dengan prinsip **Clean Architecture (Hexagonal / Onion Architecture)** menggunakan TypeScript strict mode, Express.js 5, PostgreSQL, dan Prisma ORM.

---

## 🚀 Fitur Utama

- **Otorisasi Berbasis Peran (RBAC):**
  - `SUPER_ADMIN`: Akses penuh lintas unit sekolah, kelola data master, konfigurasi tarif, audit log, dan laporan keuangan.
  - `UNIT_ADMIN`: Pengelolaan operasional keuangan dan data siswa pada unit sekolah tertentu (KB, RA, atau SD).
  - `WALI_KELAS`: Rekapitulasi tunggakan dan verifikasi tagihan siswa di kelas bimbingannya.
  - `PARENT`: Portal orang tua/wali untuk melihat rincian tagihan anak dan melakukan pembayaran online/offline.
- **Manajemen Billing & Tagihan Fleksibel:**
  - Tagihan SPP Bulanan dengan penanganan beasiswa/diskon khusus siswa.
  - Tagihan Program Fullday bulanan.
  - Tagihan PPDB (Uang Pengembangan, Seragam, Peralatan, Daftar Ulang, Ekstrakurikuler).
  - Skema pembayaran parsial (*partially paid*) dan pelunasan bertahap.
- **Metode Pembayaran:**
  - **Offline:** Kas tunai (Cash) dan Transfer Bank manual dengan verifikasi admin.
  - **Online:** Integrasi payment gateway (Pakasir / Midtrans) via QRIS/Virtual Account dengan auto-reconciliation webhook.
- **Pencatatan Keuangan (Buku Kas):**
  - Pencatatan transaksi pendapatan (Income) dan pengeluaran (Expense) berbasis kategori.
- **Audit Logging:**
  - Pencatatan otomatis setiap aktivitas penting pengguna (login, pembayaran, perubahan status tagihan) untuk transparansi.

---

## 🛠️ Tech Stack

- **Runtime & Language:** Node.js (ESM / NodeNext), TypeScript (Strict Mode).
- **Web Framework:** Express.js 5.
- **Database & ORM:** PostgreSQL dengan Prisma ORM.
- **Validation:** Zod.
- **Authentication & Security:** JSON Web Token (JWT), HttpOnly Cookie, Bcrypt, CORS.
- **Logging:** Winston Logger & HTTP Request Morgan/Access Logger.
- **Testing:** Vitest & Supertest.
- **Process Manager (Production):** PM2 di lingkungan VPS Linux.

---

## 📂 Struktur Proyek (Clean Architecture)

```
src/
├── domain/                  # Pure Core: Entities, Value Objects, Enums, Errors, Ports
│   ├── entities/            # Entity bisnis murni
│   ├── enums/               # Domain enums (Role, InvoiceStatus, InvoiceType, dll)
│   ├── errors/              # Domain errors (AppError, NotFoundError, dll)
│   ├── repositories/        # Port interface repository (IStudentRepository, dll)
│   └── services/            # Port interface domain service (IPasswordHasher, dll)
│
├── application/             # Use Cases & Orchestration Logic
│   ├── ports/               # Port adapter teknis (IDatabaseHealthIndicator, dll)
│   └── use-cases/           # Alur proses aplikasi (1 file = 1 Use Case)
│
├── infrastructure/          # Adapters, Drivers, & External World
│   ├── database/            # Prisma client & Prisma repository implementations
│   ├── http/
│   │   ├── controllers/     # Express Controllers (Thin Controllers, 100% bebas Prisma)
│   │   ├── middlewares/     # Auth, Role, Error Handler, Request Validation
│   │   ├── routes/          # Express Route definitions & Dependency Injection wiring
│   │   └── schemas/         # Zod schemas untuk validasi input request
│   ├── services/            # Implementasi layanan teknis (Bcrypt, JWT, Pakasir, Winston)
│   └── utils/               # Utilitas umum
│
└── main/                    # Composition Root
    ├── app.ts               # Inisialisasi Express & mounting route
    └── server.ts            # Entrypoint HTTP listener
```

> **Catatan Developer/AI Agent:** Panduan teknis lengkap arsitektur dan aturan penulisan kode wajib merujuk pada file [AGENTS.md](./AGENTS.md).

---

## ⚙️ Persyaratan Sistem

- **Node.js:** v20.x atau lebih baru.
- **PostgreSQL:** v14.x atau lebih baru.
- **Package Manager:** npm (disertakan bersama Node.js).

---

## 🚀 Panduan Memulai (Instalasi Lokal)

### 1. Clone Repository
```bash
git clone https://github.com/alfathrzqii/spp-backend-render.git
cd spp-backend-render
```

### 2. Pasang Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment Variables
Salin file `.env.example` ke `.env`:
```bash
cp .env.example .env
```
Sesuaikan variabel environment berikut:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/spp_db?schema=public"
JWT_SECRET="kunci_rahasia_jwt_anda_yang_sangat_panjang_dan_aman"
NODE_ENV="development"
PORT=3003

# Konfigurasi Payment Gateway (Pakasir)
PAKASIR_PROJECT_SLUG="your_project_slug"
PAKASIR_API_KEY="your_api_key"
```

### 4. Setup Database & Migrasi Prisma
Jalankan migrasi database dan generate Prisma Client:
```bash
npx prisma migrate dev --name init
npx prisma db seed # (Opsional: jika ingin mengisi data awal/master)
```

### 5. Menjalankan Server Development
```bash
npm run dev
```
Server akan aktif di `http://localhost:3003`. Endpoint health check dapat diakses di `http://localhost:3003/health`.

---

## 📜 Skrip NPM yang Tersedia

| Command | Deskripsi |
|---|---|
| `npm run dev` | Menjalankan server lokal mode watch menggunakan `tsx` |
| `npm run build` | Melakukan kompilasi TypeScript (`tsc`) ke folder `dist/` |
| `npm run start` | Menjalankan artifact hasil build produksi dari `dist/main/server.js` |
| `npm test` | Menjalankan automated test suite menggunakan Vitest |
| `npm run test:watch` | Menjalankan test dalam mode watch interaktif |
| `npm run test:coverage` | Menghasilkan laporan coverage pengujian kode |

---

## 🌐 Gambaran Endpoint API Utama

| Prefix Path | Keterangan | Otoritas Akses |
|---|---|---|
| `/health` | Health check & probe status database | Publik |
| `/api/auth` | Autentikasi (login, logout, refresh token, me) | Publik & Terautentikasi |
| `/api/students` | CRUD siswa, import data Excel, dan filter status | Super Admin, Unit Admin |
| `/api/invoices` | Tagihan, pembayaran offline, laporan tunggakan, dan rekap kelas | Super Admin, Unit Admin, Wali Kelas, Parent |
| `/api/invoices/pakasir` | Transaksi online Pakasir, status check, webhook, dan sync | Super Admin, Unit Admin, Parent |
| `/api/spp-tariffs` | Konfigurasi master tarif SPP per unit & angkatan | Super Admin, Unit Admin |
| `/api/fullday-tariffs` | Master tarif program fullday per unit & angkatan | Super Admin, Unit Admin |
| `/api/extra-equipment-tariffs` | Master tarif peralatan & ekstrakurikuler (KB/RA) | Super Admin, Unit Admin |
| `/api/re-registration-tariffs` | Master tarif daftar ulang / PPDB per unit & angkatan | Super Admin, Unit Admin |
| `/api/transactions` | Buku kas pencatatan pendapatan & pengeluaran | Super Admin, Unit Admin |
| `/api/activity-logs` | Audit trail aktivitas pengguna | Super Admin |
| `/api/users` | Pengelolaan data akun pengguna dan staf sekolah | Super Admin |

---

## 🚢 Deployment Produksi (VPS & PM2)

Proyek ini dirancang untuk dijalankan di server VPS (Ubuntu/Debian) menggunakan process manager **PM2**:

1. **Build Proyek:**
   ```bash
   npm run build
   ```
2. **Jalankan via PM2:**
   ```bash
   pm2 start dist/main/server.js --name spp-backend
   ```
3. **Simpan Konfigurasi PM2:**
   ```bash
   pm2 save
   pm2 startup
   ```
4. **Monitoring & Log:**
   ```bash
   pm2 logs spp-backend
   pm2 status
   ```

