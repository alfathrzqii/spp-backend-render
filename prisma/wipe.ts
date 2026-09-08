import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Guard lingkungan produksi
  if (process.env["NODE_ENV"] === "production") {
    console.error("⛔ EKSEKUSI DIBATALKAN: Skrip db:wipe dilarang keras dijalankan pada lingkungan produksi!");
    process.exit(1);
  }

  // 2. Guard konfirmasi eksplisit --force
  const hasForceFlag = process.argv.includes("--force");
  if (!hasForceFlag) {
    console.error("⚠️ PERINGATAN KESELAMATAN:");
    console.error("Skrip ini akan MENGHAPUS SEMUA transaksi, tagihan, siswa, dan akun wali murid.");
    console.error("Untuk mengonfirmasi eksekusi di lingkungan lokal, sertakan flag '--force':");
    console.error("  npm run db:wipe -- --force\n");
    process.exit(1);
  }

  console.log("=== Wiping All Test Dummy Data from Local Database ===");

  // 1. Delete transactions
  const delTx = await prisma.transaction.deleteMany({});
  console.log(`Deleted ${delTx.count} test transactions.`);

  // 2. Delete invoices
  const delInv = await prisma.invoice.deleteMany({});
  console.log(`Deleted ${delInv.count} test invoices.`);

  // 3. Delete students
  const delSt = await prisma.student.deleteMany({});
  console.log(`Deleted ${delSt.count} test students.`);

  // 4. Delete non-admin users (e.g. parent test accounts)
  const delUsers = await prisma.user.deleteMany({
    where: {
      role: {
        notIn: ["SUPER_ADMIN", "UNIT_ADMIN"]
      }
    }
  });
  console.log(`Deleted ${delUsers.count} test parent/user accounts.`);

  console.log("=== Database Cleanup Completed Successfully ===");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Error clearing database:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
