import prisma from "../database/prisma.js";
import type { IDatabaseHealthIndicator } from "../../application/ports/IDatabaseHealthIndicator.js";

export class PrismaHealthIndicator implements IDatabaseHealthIndicator {
  async isHealthy(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
