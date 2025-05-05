import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { SearchAuditLogDto } from "./dto/search-audit-log.dto";
import { AuditLogService } from "./auditLog.service";

@Controller("audit-log")
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async getAllAuditLogs() {
    return this.auditLogService.getAllAuditLogs();
  }

  @Get("search")
  async searchAuditLogs(@Query() dto: SearchAuditLogDto) {
    return this.auditLogService.findAll({
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });
  }

  @Get("count")
  async getAuditLogsCount(@Query() dto: SearchAuditLogDto) {
    return this.auditLogService.count({
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });
  }

  @Post()
  async createAuditLog(
    @Body()
    body: {
      eventType: string;
      userID: string;
      details: string;
      documentID?: string;
    },
  ) {
    return this.auditLogService.addAuditLog(body);
  }
}
