export interface FindActivityLogsParams {
  action?: string | undefined;
  search?: string | undefined;
  take: number;
  skip: number;
}

export interface ActivityLogWithUser {
  id: number;
  userId: number;
  action: string;
  description: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  user: {
    id: number;
    name: string;
    role: string;
    email: string;
  };
}

export interface CreateActivityLogDTO {
  userId: number;
  action: string;
  description: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface IActivityLogRepository {
  findManyWithCount(params: FindActivityLogsParams): Promise<{
    logs: ActivityLogWithUser[];
    total: number;
  }>;
  create(data: CreateActivityLogDTO): Promise<void>;
}
