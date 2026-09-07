import prisma from "./prisma.js";
import type {
  IActivityLogRepository,
  FindActivityLogsParams,
  ActivityLogWithUser,
  CreateActivityLogDTO,
} from "../../domain/repositories/IActivityLogRepository.js";

export class PrismaActivityLogRepository implements IActivityLogRepository {
  async findManyWithCount(params: FindActivityLogsParams): Promise<{
    logs: ActivityLogWithUser[];
    total: number;
  }> {
    const { action, search, take, skip } = params;

    const where: any = {};

    if (action) {
      where.action = action;
    }

    if (search) {
      where.OR = [
        {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          user: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take,
        skip,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return {
      logs: logs as ActivityLogWithUser[],
      total,
    };
  }

  async create(data: CreateActivityLogDTO): Promise<void> {
    await prisma.activityLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        description: data.description,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  }
}
