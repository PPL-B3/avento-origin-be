import { DocumentModule } from "./document/document.module";
import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { PrismaService } from "./prisma/prisma.service";

@Module({
  imports: [DocumentModule, PrismaModule],
  providers: [PrismaService],
})
export class AppModule {}
