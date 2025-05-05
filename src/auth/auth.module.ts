import { Module } from "@nestjs/common";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.service";
import { JwtService } from "./jwt/jwt.service";
import { AuditLogModule } from "../auditLog/auditLog.module";
import { DefaultPasswordPolicy } from "./policies/default-password.policy";

@Module({
  imports: [AuditLogModule],
  providers: [
    AuthService,
    JwtService,
    {
      provide: "PasswordPolicy",
      useClass: DefaultPasswordPolicy,
    },
  ],
  controllers: [AuthController],
  exports: [JwtService],
})
export class AuthModule {}
