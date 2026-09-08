import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

export default prisma;
