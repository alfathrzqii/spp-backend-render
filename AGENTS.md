# SPP-Backend - Project Guidelines

Dokumen ini adalah panduan resmi arsitektur, standar penulisan kode, alur kerja, dan deployment untuk developer serta AI coding assistants (Antigravity, Codex, Copilot, dsb.) di repository **SPP Backend**.

Setiap kontributor atau AI agent yang memodifikasi, merefaktor, atau menambahkan fitur baru di repository ini **WAJIB** membaca dan mematuhi seluruh aturan di dokumen ini tanpa terkecuali.

---

## 1. Project Overview, Tech Stack & Deployment

### A. Tentang Proyek

**SPP-Backend** adalah backend sistem informasi manajemen keuangan sekolah (SPP, Fullday, Uang Pembangunan, Seragam, Ekstrakurikuler, Peralatan, dan Daftar Ulang / PPDB, Pencatatan Keuangan, dll) multi-unit sekolah (KB, RA, SD) berbasis role (Super Admin, Unit Admin, Wali Kelas, dan Parent/Wali Siswa). Backend ini juga mengintegrasikan pembayaran online via payment gateway.

### B. Tech Stack Utama

- **Runtime & Bahasa:** Node.js (ESM / NodeNext) & TypeScript (Strict Mode).
- **Web Framework:** Express.js 5.
- **Database & ORM:** PostgreSQL dengan Prisma ORM.
- **Validasi Request:** Zod.
- **Autentikasi & Keamanan:** JSON Web Token (JWT), HttpOnly Cookies, Bcrypt.
- **Logging:** Winston Logger & HTTP Access Logger.
- **Testing:** Vitest & Supertest.

### C. Lingkungan Eksekusi & Target Deployment

- Proyek ini dirancang untuk dijalankan di **Virtual Private Server (VPS)** menggunakan Process Manager **PM2**.
- Build artifact dihasilkan melalui `tsc` ke folder `dist/`.
- Entrypoint produksi: `node dist/main/server.js` (atau via PM2: `pm2 start dist/main/server.js --name spp-backend`).
- Seluruh kode harus stateless, production-ready, menangani graceful shutdown, dan tidak bergantung pada runner dev (`tsx`/`ts-node`) saat di server VPS.

---

## 2. Arsitektur Inti: Clean Architecture

Proyek ini dibangun dengan prinsip **Clean Architecture (Onion/Hexagonal Architecture)**. Ketergantungan kode (dependency graph) **hanya boleh mengarah ke dalam (Inward Dependency Rule)**:

```
[ Infrastructure Layer ]  -->  [ Application Layer ]  -->  [ Domain Layer ]
      (Outer World)               (Business Logic)             (Pure Core)
```

### Struktur Folder `src/`:

```
src/
├── domain/                  # Lapis 1: Inti Bisnis Murni (Paling Dalam)
│   ├── entities/            # Entity bisnis murni (bebas framework/ORM)
│   ├── enums/               # Domain enums murni (Role, InvoiceStatus, PaymentMethod, dll)
│   ├── errors/              # Domain errors (DomainError, AppError, NotFoundError, dll)
│   ├── repositories/        # Port interfaces (IStudentRepository, IInvoiceRepository, dll)
│   └── services/            # Domain service interfaces (IPasswordHasher, ITokenService, dll)
│
├── application/             # Lapis 2: Use Cases & Application Ports
│   ├── ports/               # Port adapter teknis (IDatabaseHealthIndicator, dll)
│   └── use-cases/           # Alur proses aplikasi spesifik (1 file = 1 Use Case)
│
├── infrastructure/          # Lapis 3: Frameworks, Driver, & Eksternal (Paling Luar)
│   ├── database/            # Prisma client & Prisma repository implementations
│   ├── http/
│   │   ├── controllers/     # Express Controllers (Thin Controllers, 100% Bebas Prisma)
│   │   ├── middlewares/     # Middleware Express (auth, role, validateRequest, errorHandler, httpLogger)
│   │   ├── routes/          # Express Routers & Dependency Wiring
│   │   └── schemas/         # Zod schemas untuk validasi HTTP request input
│   ├── services/            # Implementasi layanan teknis (Bcrypt, JWT, Pakasir, Winston, dll)
│   └── utils/               # Utility umum infrastruktur
│
└── main/                    # Composition Root
    ├── app.ts               # Inisialisasi Express & mounting routers
    ├── server.ts            # Entrypoint HTTP listener
    └── container.ts         # Manual dependency injection container (bila diperlukan)
```

---

## 3. Aturan Ketat Setiap Layer (Golden Rules)

### A. Domain Layer (`src/domain/`)

- **Aturan Kemurnian 100%:** DILARANG mengimpor library luar, framework, database, ORM (`@prisma/client`, `prisma`), atau `express`.
- Hanya berisi pure TypeScript types, interfaces, entities, enums, dan error classes.
- Entity dan Error di domain tidak boleh membawa HTTP status code (misal `statusCode = 404`). HTTP status code adalah urutan lapisan HTTP infrastruktur.

### B. Application Layer (`src/application/`)

- Hanya boleh mengimpor dari `src/domain/` atau port internal di `src/application/ports/`.
- **DILARANG mengimpor dari `src/infrastructure/`** (seperti `express`, `prisma`, dsb).
- Setiap use case harus fokus pada satu tugas (Single Responsibility Principle) dan memiliki method `execute(dto)`.
- Use case hanya berinteraksi dengan dunia luar melalui port interface (Dependency Inversion Principle).

### C. Infrastructure Layer (`src/infrastructure/`)

- **Controllers:**
  - Wajib bertindak sebagai **Thin Controller**.
  - **DILARANG MENGIMPOR `prisma` LANGSUNG DI CONTROLLER!** Semua query database dan logika bisnis wajib melalui Use Cases atau Repositories.
  - Tugas controller HANYA mengekstrak request (body, query, params), memvalidasi DTO, memanggil Use Case, dan mengembalikan HTTP response.
- **Repositories (`src/infrastructure/database/`):**
  - Mengimplementasikan repository interfaces dari `src/domain/repositories/`.
  - Tempat resmi pemanggilan database Prisma (`prisma.student`, `prisma.invoice`, dsb).
- **Middlewares (`src/infrastructure/http/middlewares/`):**
  - Semua error dilempar menggunakan `next(error)` atau dilempar via `throw` agar ditangkap oleh `errorHandler.ts`.
  - `errorHandler.ts` memetakan Domain Error (`NotFoundError` -> 404, `ForbiddenError` -> 403, `BadRequestError` -> 400, `ConflictError` -> 409) ke HTTP status code.

---

## 4. TypeScript & Coding Standards

Proyek ini menggunakan konfigurasi TypeScript yang sangat ketat (`tsconfig.json`). Setiap AI agent dan developer wajib memperhatikan:

1. **`verbatimModuleSyntax: true`**
   
   - Import tipe data wajib menggunakan `import type { ... }`:
     
     ```typescript
     // BENAR
     import type { Request, Response, NextFunction } from "express";
     import type { IStudentRepository } from "../../../domain/repositories/IStudentRepository.js";
     
     // SALAH (akan menyebabkan error build tsc)
     import { Request, Response } from "express";
     ```

2. **`exactOptionalPropertyTypes: true`**
   
   - Jika suatu properti di interface/type bersifat opsional, definisikan dengan `| undefined`:
     
     ```typescript
     // BENAR
     export interface GetInvoicesDTO {
       year?: number | undefined;
       className?: string | undefined;
     }
     
     // SALAH (akan error saat passing variabel bertipe `number | undefined`)
     export interface GetInvoicesDTO {
       year?: number;
     }
     ```

3. **ESM Import Extension (`.js`)**
   
   - Karena modul NodeNext ESM aktif, setiap local import **wajib menyertakan ekstensi `.js`**:
     
     ```typescript
     import { prisma } from "../database/prisma.js"; // BENAR
     import { prisma } from "../database/prisma";    // SALAH
     ```

4. **Build Verification Mandat**
   
   - Setiap selesai mengedit file, wajib memverifikasi hasil dengan:
     
     ```bash
     npm run build
     ```
   
   - Build **wajib menghasilkan Exit Code 0**.

---

## 5. Pengelolaan Berkas Sementara & Dokumentasi Lokal (`temp/`)

Jika user meminta dokumentasi, penjelasan, visualisasi data, analisis, atau output dalam bentuk file Markdown (`.md`) / HTML (`.html`):

- **Seluruh berkas tersebut wajib ditulis ke dalam folder `temp/`** (contoh: `temp/penjelasan-arsitektur.md`, `temp/report.html`).
- Folder `temp/` ini juga digunakan untuk segala keperluan pengembangan lokal (misalnya menyimpan log pengujian, scratchpad, dan dump sementara).
- **Folder `temp/` telah diabaikan oleh Git (`.gitignore`)**, sehingga berkas di dalamnya tidak akan mengotori riwayat commit repository.

---

## 6. Cheat Sheet Cek Kepatuhan (Self-Check Checklist)

Sebelum menyelesaikan task, wajib mengecek daftar periksa berikut:

- [ ] Apakah `npm run build` sukses (exit code 0)?
- [ ] Apakah ada `import prisma` di `src/infrastructure/http/controllers/`? (Harus **0 hasil**).
- [ ] Apakah ada impor `express` atau framework di `src/domain/` atau `src/application/`? (Harus **0 hasil**).
- [ ] Apakah seluruh import tipe menggunakan `import type`?
- [ ] Apakah seluruh path import lokal berakhiran `.js`?
- [ ] Apakah berkas penjelasan/dokumentasi/log sementara sudah ditempatkan di `temp/`?
- [ ] Apakah respons API tetap kompatibel dan tidak mematahkan kontrak frontend (Zero Breaking Changes)?
