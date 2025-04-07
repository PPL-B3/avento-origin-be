import { Module } from "@nestjs/common";
import { AuditLogController } from "./auditLog.controller";
import { AuditLogService } from "./auditLog.service";

@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
