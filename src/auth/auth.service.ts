import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthDto } from './dto';
import * as argon from 'argon2';

@Injectable()
export class AuthService {
  constructor(private readonly prismaService: PrismaService) {}

  async register(dto: AuthDto) {
    const hash = await argon.hash(dto.password);
    const user = await this.prismaService.user.create({
      data: {
        email: dto.email,
        password: hash,
        role: 'user',
      },
      select: {
        id: true,
        email: true,
      },
    });
    return user;
  }
}
