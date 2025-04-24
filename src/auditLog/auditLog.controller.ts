import { Controller, Get } from "@nestjs/common";
import { AuditLogService } from "./auditLog.service";

@Controller("audit-log")
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async getAllAuditLogs() {
    return this.auditLogService.getAllAuditLogs();
  }
}
