
import { JwtAuthMiddleware } from "../auth/jwt/middleware/jwt-auth.middleware";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuditLogService } from "./auditLog.service";

@Controller("audit-log")
@UseGuards(JwtAuthMiddleware, RolesGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Roles("ADMIN")
  async getAllAuditLogs() {
    return this.auditLogService.getAllAuditLogs();
  }

  @Get("search")
  async searchAuditLogs(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Query("query") query?: string,
    @Query("eventType") eventType?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("userId") userId?: string,
  ) {
    return this.auditLogService.findAll({
      page,
      limit,
      query,
      eventType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      userId,
    });
  }

  @Get("count")
  async getAuditLogsCount(
    @Query("query") query?: string,
    @Query("eventType") eventType?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("userId") userId?: string,
  ) {
    return this.auditLogService.count({
      query,
      eventType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      userId,
    });
  }
}
