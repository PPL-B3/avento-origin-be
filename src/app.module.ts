import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { DocumentsModule } from "./document/document.module";
import { HelloModule } from "./hello/hello.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PrismaService } from "./prisma/prisma.service";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "@nestjs/config";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";
import { AuditLogModule } from "./auditLog/auditLog.module";
import { JwtAuthMiddleware } from "./auth/jwt/middleware/jwt-auth.middleware";
import { RolesGuard } from "./auth/roles.guard";
import { AdminSeederService } from "./auth/adminseeder.service";
import {MetricsModule} from "./pushBack/metrics.module";

@Module({
  imports: [
    HelloModule,
    PrismaModule,
    AuthModule,
    DocumentsModule,
    PrometheusModule.register(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuditLogModule,
    MetricsModule,
  ],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: RolesGuard },
    AdminSeederService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtAuthMiddleware).forRoutes(
      { path: "documents/upload", method: RequestMethod.ALL },
      {
        path: "documents/get-document/:documentId",
        method: RequestMethod.ALL,
      },
      { path: "audit-log", method: RequestMethod.ALL },
    );
  }
}
