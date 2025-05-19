import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { DocumentsModule } from "./document/document.module";
import { HelloModule } from "./hello/hello.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PrismaService } from "./prisma/prisma.service";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "@nestjs/config";
import { PrometheusModule, makeCounterProvider, makeHistogramProvider } from "@willsoto/nestjs-prometheus";
import { AuditLogModule } from "./auditLog/auditLog.module";
import { JwtAuthMiddleware } from "./auth/jwt/middleware/jwt-auth.middleware";
import { RolesGuard } from "./auth/guards/roles.guard";
import { AdminSeederService } from "./auth/services/adminseeder.service";
import { MetricsInterceptor } from "./metrics.interceptor";

@Module({
  imports: [
    HelloModule,
    PrismaModule,
    AuthModule,
    DocumentsModule,
    PrometheusModule.register({
      path: "/metrics",
      defaultMetrics: { enabled: true },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuditLogModule,
  ],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: RolesGuard },
    AdminSeederService,
    makeHistogramProvider({
      name: "http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "route", "status"],
      buckets: [0.1, 0.3, 0.5, 1, 2, 5],
    }),
    makeCounterProvider({
      name: "http_requests_total",
      help: "Total number of HTTP requests",
      labelNames: ["method", "route", "status"],
    }),
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
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
