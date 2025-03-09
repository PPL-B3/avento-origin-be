import { DocumentModule } from './document/document.module';
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { HelloModule } from './hello/hello.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [HelloModule, PrismaModule, AuthModule, DocumentModule],
  providers: [PrismaService],
})
export class AppModule {}
