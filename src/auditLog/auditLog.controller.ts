import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthMiddleware } from "../auth/jwt/middleware/jwt-auth.middleware";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
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
}
