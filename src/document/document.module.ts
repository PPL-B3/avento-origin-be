// documents.module.ts
import { Module } from "@nestjs/common";
import { DocumentController } from "./controllers/document.controller";
import { DocumentService } from "./services/document.service";
import { S3StorageService } from "./services/s3-storage.service";
import { EmailService } from "./services/email.service";
import { DocumentRepository } from "./repositories/document.repository";
import { PostHogModule } from "../posthog/posthog.module";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import { AuditLogModule } from "../auditLog/auditLog.module";
import { JwtService } from "../auth/jwt/jwt.service";

@Module({
  imports: [PostHogModule, AuditLogModule],
  controllers: [DocumentController],
  providers: [
    DocumentService,
    S3StorageService,
    EmailService,
    DocumentRepository,
    PrismaService,
    ConfigService,
    JwtService,
  ],
})
export class DocumentsModule {}
