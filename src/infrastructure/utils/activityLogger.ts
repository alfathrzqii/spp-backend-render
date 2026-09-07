import type { Request } from "express";
import { PrismaActivityLogRepository } from "../database/PrismaActivityLogRepository.js";
import { logger } from "../services/WinstonLogger.js";

const activityLogRepo = new PrismaActivityLogRepository();

export async function logActivity(
  userId: number,
  action: string,
  description: string,
  req?: Request
): Promise<void> {
  try {
    let ipAddress: string | null = null;
    let userAgent: string | null = null;
    if (req) {
      const forwarded = req.headers["x-forwarded-for"];
      let rawIp: string | null = null;
      if (typeof forwarded === "string") {
        rawIp = forwarded;
      } else if (Array.isArray(forwarded) && forwarded.length > 0 && typeof forwarded[0] === "string") {
        rawIp = forwarded[0];
      } else if (req.socket && typeof req.socket.remoteAddress === "string") {
        rawIp = req.socket.remoteAddress;
      }

      if (rawIp !== null) {
        ipAddress = rawIp.split(",")[0]?.trim() || null;
      }

      userAgent = (req.headers["user-agent"] as string) || null;
    }
      
    await activityLogRepo.create({
      userId,
      action,
      description,
      ipAddress,
      userAgent,
    });
  } catch (error: any) {
    logger.error(`Gagal mencatat log aktivitas: ${error.message}`);
  }
}
