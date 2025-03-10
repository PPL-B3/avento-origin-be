import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { DocumentModule } from './document/document.module';
import { HelloModule } from "./hello/hello.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PrismaService } from "./prisma/prisma.service";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthMiddleware } from "./auth/jwt/middleware/jwt-auth.middleware";


@Module({
  imports: [HelloModule, PrismaModule, AuthModule, DocumentModule],
  providers: [PrismaService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(JwtAuthMiddleware)
      .exclude(
        { path: "auth/register", method: RequestMethod.POST },
        { path: "auth/login", method: RequestMethod.POST },
      )
      .forRoutes("*"); // semua route pakai middleware ini
  }
}
