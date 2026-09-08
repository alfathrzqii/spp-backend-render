import type { CorsOptions } from "cors";
import { logger } from "../../services/WinstonLogger.js";

const DEFAULT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

export function getCorsOptions(): CorsOptions {
  const envOrigins = process.env["CLIENT_ORIGIN"]
    ? process.env["CLIENT_ORIGIN"]
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];

  const allowedOrigins = [...new Set([...DEFAULT_DEV_ORIGINS, ...envOrigins])];

  return {
    origin: (origin, callback) => {
      // Izinkan request tanpa origin (seperti webhook Pakasir server-to-server, cURL, Postman, atau mobile native)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Origin tidak terdaftar: jangan lampirkan Access-Control-Allow-Origin, catat log peringatan
      logger.warn(`[CORS] Request dari origin yang tidak diizinkan: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
  };
}

export const corsOptions = getCorsOptions();
