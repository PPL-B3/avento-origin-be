import { Module } from '@nestjs/common';
import { HelloModule } from './hello/hello.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [HelloModule, PrismaModule, AuthModule],
  providers: [PrismaService],
})
export class AppModule {}
