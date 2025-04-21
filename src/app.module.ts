import {
  MiddlewareConsumer,
  // MiddlewareConsumer,
  Module,
  NestModule,
  // NestModule,
  // RequestMethod,
} from "@nestjs/common";
import { DocumentsModule } from "./document/document.module";
import { HelloModule } from "./hello/hello.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PrismaService } from "./prisma/prisma.service";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "@nestjs/config";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";
import { AuditLogModule } from "./auditLog/auditLog.module";
import { JwtAuthMiddleware } from "./auth/jwt/middleware/jwt-auth.middleware";

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
  ],
  providers: [PrismaService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtAuthMiddleware).forRoutes("documents/upload");
  }
}
