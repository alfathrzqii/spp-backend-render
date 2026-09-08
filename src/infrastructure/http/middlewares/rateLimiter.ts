import type { Request, Response, NextFunction } from "express";
import { logger } from "../../services/WinstonLogger.js";

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    max,
    message = "Terlalu banyak permintaan. Silakan coba beberapa saat lagi.",
  } = options;

  const hits = new Map<string, ClientRecord>();

  // Interval pembersihan memori setiap 5 menit agar tidak terjadi memory leak
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // unref() agar timer ini tidak menghalangi Node.js shutdown
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // Lewati rate limiter saat automated test dijalankan
    if (process.env["NODE_ENV"] === "test") {
      return next();
    }

    const forwarded = req.headers["x-forwarded-for"];
    const ip =
      (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : null) ||
      req.ip ||
      "unknown-ip";

    const now = Date.now();
    const record = hits.get(ip);

    if (!record || now > record.resetTime) {
      hits.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });

      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", max - 1);
      res.setHeader("X-RateLimit-Reset", Math.ceil((now + windowMs) / 1000));
      return next();
    }

    record.count += 1;
    const remaining = Math.max(0, max - record.count);
    const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      res.setHeader("Retry-After", retryAfterSec);
      logger.warn(
        `[RateLimit] IP ${ip} melebihi batas request pada ${req.method} ${req.originalUrl}. Percobaan ke-${record.count}.`
      );

      res.status(429).json({
        success: false,
        message,
        retryAfter: retryAfterSec,
      });
      return;
    }

    return next();
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10, // Maksimal 10 percobaan per IP
  message: "Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.",
});
