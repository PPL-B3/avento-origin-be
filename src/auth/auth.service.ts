import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
import { AuthDto } from './dto';
import * as argon from 'argon2';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class AuthService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Menandai token sebagai tidak valid dengan menyimpan timestamp logout di database.
   */
  async blacklistToken(userId: string): Promise<void> {
    await this.prismaService.user.update({
      where: { id: userId },
      data: { lastLogout: new Date() },
    });
  }

  /**
   * Memeriksa apakah token sudah kadaluarsa berdasarkan lastLogout user.
   */
  async isTokenBlacklisted(token: string, userId: string): Promise<boolean> {
    try {
      const user = await this.prismaService.user.findUnique({
        where: { id: userId },
      });

      if (!user?.lastLogout) return true; // If no user or lastLogout, blacklist token

      const decoded = jwt.decode(token) as jwt.JwtPayload;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (!decoded?.iat) return true; // If token is invalid or doesn't have 'iat', blacklist token

      const tokenIssuedAt = decoded.iat; // Token's 'issued at' time
      const userLastLogout = Math.floor(user.lastLogout.getTime() / 1000); // Convert lastLogout to seconds

      // Return true if token is issued before the lastLogout (meaning blacklisted)
      return tokenIssuedAt <= userLastLogout; // Token is blacklisted if issued before or exactly at the last logout
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return true; // In case of error, treat token as blacklisted
    }
  }

  async logout(userId: string): Promise<void> {
    await this.blacklistToken(userId);
  }

  async register(dto: AuthDto) {
    const hash = await argon.hash(dto.password);
    try {
      const user = await this.prismaService.user.create({
        data: {
          email: dto.email,
          password: hash,
          role: 'user',
        },
      });

      return {
        id: user.id,
        email: user.email,
        role: user.role,
      };
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ForbiddenException('Email has already been registered');
        }
      } else {
        throw err;
      }
    }
  }

  async login(dto: AuthDto) {
    const user = await this.prismaService.user.findUnique({
      where: {
        email: dto.email,
      },
    });
    if (!user) {
      throw new ForbiddenException('Username or password is incorrect');
    }

    const passwordMatches = await argon.verify(user.password, dto.password);
    if (!passwordMatches) {
      throw new ForbiddenException('Username or password is incorrect');
    }

    return {
      id: user.id,
      email: user.email,
      role: 'user',
      lastLogout: user.lastLogout,
    };
  }
}
