import { PrismaClient, Role, CategoryType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Memulai Proses Seeding Database ===');

  // 1. Hashing Password Default untuk Akun Demo
  const saltRounds = 10;
  const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, saltRounds);
  };

  const defaultPasswordAdmin = await hashPassword('admin123');
  const defaultPasswordParent = await hashPassword('parent123');

  // 2. Seed Data Master: School Units (Unit Sekolah)
  console.log('Seeding data unit sekolah...');
  const unitRA = await prisma.schoolUnit.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'RA/KB',
    },
  });

  const unitTK = await prisma.schoolUnit.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: 'TK',
    },
  });

  const unitSD = await prisma.schoolUnit.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      name: 'SD',
    },
  });

  const unitTPA = await prisma.schoolUnit.upsert({
    where: { id: 4 },
    update: {},
    create: {
      id: 4,
      name: 'TPA',
    },
  });

  console.log('Unit sekolah berhasil disiapkan.');

  // 3. Seed Data Master: Users (Pengguna Pengujian)
  console.log('Seeding data pengguna default...');

  // Akun Super Admin (Bisa mengelola semua unit - schoolUnitId NULL)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@sekolah.sch.id' },
    update: {},
    create: {
      name: 'Super Admin Yayasan',
      email: 'superadmin@sekolah.sch.id',
      password: defaultPasswordAdmin,
      role: Role.SUPER_ADMIN,
      schoolUnitId: null, // Akses global
    },
  });

  // Akun Admin Unit SD (Hanya mengelola unit SD - schoolUnitId: 3)
  const adminSD = await prisma.user.upsert({
    where: { email: 'adminsd@sekolah.sch.id' },
    update: {},
    create: {
      name: 'Admin Keuangan SD',
      email: 'adminsd@sekolah.sch.id',
      password: defaultPasswordAdmin,
      role: Role.UNIT_ADMIN,
      schoolUnitId: unitSD.id,
    },
  });

  // Akun Orang Tua (Wali Murid - schoolUnitId NULL agar fleksibel multi-unit anak)
  const parent = await prisma.user.upsert({
    where: { email: 'parent@test.com' },
    update: {},
    create: {
      name: 'Hendra Wijaya (Wali Murid)',
      email: 'parent@test.com',
      phoneNumber: '081234567890',
      password: defaultPasswordParent,
      role: Role.PARENT,
      schoolUnitId: null,
    },
  });

  console.log('Data pengguna default berhasil disiapkan.');

  // 4. Seed Data Master: Kategori Transaksi Buku Kas (Categories)
  console.log('Seeding data kategori transaksi keuangan...');
  const defaultCategories = [
    { id: 1, name: 'SPP', type: CategoryType.INCOME, schoolUnitId: null },
    { id: 2, name: 'BOS', type: CategoryType.INCOME, schoolUnitId: null },
    { id: 3, name: 'Donatur', type: CategoryType.INCOME, schoolUnitId: null },
    { id: 4, name: 'Gaji Guru', type: CategoryType.EXPENSE, schoolUnitId: null },
    { id: 5, name: 'Operasional', type: CategoryType.EXPENSE, schoolUnitId: null },
  ];

  for (const cat of defaultCategories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {},
      create: {
        id: cat.id,
        name: cat.name,
        type: cat.type,
        schoolUnitId: cat.schoolUnitId,
      },
    });
  }
  console.log('Kategori transaksi berhasil disiapkan.');

  // 5. Seed Data Master: Tarif SPP per Angkatan (SppTariff)
  console.log('Seeding data tarif dasar SPP angkatan...');
  // SD Angkatan 2024: Rp 150.000 / bulan
  await prisma.sppTariff.upsert({
    where: {
      uq_school_unit_enrollment_year: {
        schoolUnitId: unitSD.id,
        enrollmentYear: 2024,
      },
    },
    update: {},
    create: {
      schoolUnitId: unitSD.id,
      enrollmentYear: 2024,
      amount: 150000,
    },
  });

  // SD Angkatan 2025: Rp 175.000 / bulan
  await prisma.sppTariff.upsert({
    where: {
      uq_school_unit_enrollment_year: {
        schoolUnitId: unitSD.id,
        enrollmentYear: 2025,
      },
    },
    update: {},
    create: {
      schoolUnitId: unitSD.id,
      enrollmentYear: 2025,
      amount: 175000,
    },
  });

  // TK Angkatan 2025: Rp 120.000 / bulan
  await prisma.sppTariff.upsert({
    where: {
      uq_school_unit_enrollment_year: {
        schoolUnitId: unitTK.id,
        enrollmentYear: 2025,
      },
    },
    update: {},
    create: {
      schoolUnitId: unitTK.id,
      enrollmentYear: 2025,
      amount: 120000,
    },
  });
  console.log('Tarif dasar SPP berhasil disiapkan.');

  // 6. Seed Data Master: Siswa (Student)
  console.log('Seeding data siswa pengujian...');
  // Menambahkan anak ke Parent Hendra Wijaya yang bersekolah di SD angkatan 2024 dengan diskon SPP 10%
  await prisma.student.upsert({
    where: { studentNumber: 'SD-2024-001' },
    update: {},
    create: {
      studentNumber: 'SD-2024-001',
      name: 'Budi Santoso',
      className: '6A',
      schoolUnitId: unitSD.id,
      parentId: parent.id,
      enrollmentYear: 2024,
      discountPercentage: 10, // Dapat potongan diskon 10%
    },
  });

  // Menambahkan anak kedua ke Parent Hendra Wijaya yang bersekolah di TK angkatan 2025 tanpa diskon
  await prisma.student.upsert({
    where: { studentNumber: 'TK-2025-001' },
    update: {},
    create: {
      studentNumber: 'TK-2025-001',
      name: 'Siti Aminah',
      className: 'TK A1',
      schoolUnitId: unitTK.id,
      parentId: parent.id,
      enrollmentYear: 2025,
      discountPercentage: 0,
    },
  });

  console.log('Data siswa pengujian berhasil disiapkan.');

  console.log('🔄 Menyinkronkan database sequence auto-increment...');

  // Daftar tabel yang menggunakan ID auto-increment statis di seeder
  const tables = ['school_units', 'categories'];

  for (const tableName of tables) {
    await prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('"${tableName}"', 'id'),
        coalesce(max(id), 0) + 1,
        false
      ) FROM "${tableName}";
    `);
  }

  console.log('✅ Semua database sequence berhasil disinkronkan!');

  console.log('\n=== Proses Seeding Selesai dengan Sukses! ===');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Terjadi error saat proses seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

