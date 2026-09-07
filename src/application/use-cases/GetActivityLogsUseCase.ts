import type { IActivityLogRepository } from "../../domain/repositories/IActivityLogRepository.js";

export interface GetActivityLogsDTO {
  search?: string | undefined;
  action?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export class GetActivityLogsUseCase {
  constructor(private activityLogRepository: IActivityLogRepository) {}

  async execute(dto: GetActivityLogsDTO) {
    const limitVal = dto.limit ?? 50;
    const pageVal = dto.page ?? 1;

    const take = isNaN(limitVal) ? 50 : limitVal;
    const page = isNaN(pageVal) ? 1 : pageVal;
    const skip = (page - 1) * take;

    const { logs, total } = await this.activityLogRepository.findManyWithCount({
      action: dto.action,
      search: dto.search,
      take,
      skip,
    });

    return {
      logs,
      pagination: {
        total,
        limit: take,
        page: Number(page),
        totalPages: Math.ceil(total / take),
      },
    };
  }
}
