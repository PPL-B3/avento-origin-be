import { Module } from "@nestjs/common";
import { AuditLogController } from "./auditLog.controller";
import { AuditLogService } from "./auditLog.service";
import { JwtService } from "../auth/jwt/jwt.service";

@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService, JwtService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
