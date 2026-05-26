/**
 * Script Inisialisasi Struktur Folder Clean Architecture
 * Proyek: spp-backend
 * * Cara menjalankan:
 * 1. Letakkan file ini di root folder proyek Anda.
 * 2. Jalankan perintah: node init-folders.js
 */

const fs = require('fs');
const path = require('path');

// Struktur direktori yang akan dibuat berdasarkan AGENTS.md
const directories = [
  'src/domain/entities',
  'src/domain/repositories',
  'src/application/use-cases',
  'src/infrastructure/database',
  'src/infrastructure/http/controllers',
  'src/infrastructure/http/middlewares',
  'src/infrastructure/http/routes',
  'src/infrastructure/services',
  'src/main',
];

// File-file placeholder awal untuk mempermudah navigasi AI Agent atau Anda sendiri
const placeholders = {
  'src/domain/entities/User.ts': '// Entitas Bisnis User murni\n',
  'src/domain/repositories/IUserRepository.ts': '// Interface/Kontrak untuk repositori User\n',
  'src/application/use-cases/LoginUseCase.ts': '// Use Case untuk proses Autentikasi Login\n',
  'src/infrastructure/database/PrismaUserRepository.ts': '// Implementasi IUserRepository menggunakan Prisma Client\n',
  'src/infrastructure/http/controllers/AuthController.ts': '// Controller untuk menangani request Autentikasi\n',
  'src/infrastructure/http/middlewares/authMiddleware.ts': '// Middleware verifikasi JWT Cookie\n',
  'src/infrastructure/http/routes/authRoutes.ts': '// Routing Express untuk /api/auth/*\n',
  'src/infrastructure/services/BcryptHasher.ts': '// Service pembantu untuk enkripsi password\n',
  'src/main/app.ts': '// Express Application Setup (Routing & Middleware Global)\n',
  'src/main/server.ts': '// Bootstrapping server Express dan koneksi database\n',
};

function buildStructure() {
  console.log('=== Memulai Setup Struktur Folder Clean Architecture ===\n');

  // 1. Membuat semua direktori yang dibutuhkan
  directories.forEach((dir) => {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`[DIR] Berhasil dibuat: ${dir}`);
    } else {
      console.log(`[DIR] Sudah ada: ${dir}`);
    }
  });

  console.log('\n=== Memasukkan File Placeholder ===\n');

  // 2. Membuat file placeholder jika belum ada
  Object.entries(placeholders).forEach(([filePath, content]) => {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`[FILE] Berhasil dibuat: ${filePath}`);
    } else {
      console.log(`[FILE] Sudah ada: ${filePath}`);
    }
  });

  console.log('\n=== Setup Selesai! Selamat ber-coding! ===');
}

buildStructure();
