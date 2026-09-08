import "dotenv/config";
import app from "./app.js";
import { disconnectDatabase } from "../infrastructure/database/prisma.js";
import { logger } from "../infrastructure/services/WinstonLogger.js";

const PORT = process.env["PORT"] || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT} [NODE_ENV=${process.env["NODE_ENV"] || "development"}]`);
});

let isShuttingDown = false;

async function handleShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Menerima sinyal ${signal}. Memulai proses graceful shutdown...`);

  // Batas toleransi maksimal 10 detik sebelum force exit
  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown melebihi batas waktu 10 detik. Memaksa proses berhenti.");
    process.exit(1);
  }, 10000);

  if (forceExitTimer.unref) {
    forceExitTimer.unref();
  }

  // 1. Hentikan penerimaan request HTTP baru dan selesaikan request yang sedang aktif
  server.close(async (err) => {
    if (err) {
      logger.error("Error saat menutup server HTTP", err.stack || err.message);
    } else {
      logger.info("Server HTTP berhasil ditutup. Tidak ada request baru yang diterima.");
    }

    // 2. Putus koneksi database PostgreSQL secara bersih
    try {
      await disconnectDatabase();
      logger.info("Koneksi database PostgreSQL (Prisma) berhasil diputus.");
    } catch (dbErr: any) {
      logger.error("Error saat memutus koneksi database", dbErr?.stack || String(dbErr));
    }

    clearTimeout(forceExitTimer);
    logger.info("Graceful shutdown selesai. Proses keluar dengan aman.");
    process.exit(0);
  });
}

// Tangani sinyal sistem operasi dari PM2 / Docker / Terminal
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

// Tangani unexpected fatal errors agar tercatat di log
process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception terdeteksi", error.stack || error.message);
  handleShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason: unknown) => {
  const trace = reason instanceof Error ? reason.stack : String(reason);
  logger.error("Unhandled Rejection terdeteksi", trace);
  handleShutdown("unhandledRejection");
});
