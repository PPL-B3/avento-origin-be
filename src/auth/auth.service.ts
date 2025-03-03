import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as jwt from "jsonwebtoken";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Menandai token sebagai tidak valid dengan menyimpan timestamp logout di database.
   */
  async blacklistToken(userId: string): Promise<void> {
    // @ts-ignore
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLogout: new Date() },
    });
  }

  /**
   * Memeriksa apakah token sudah kadaluarsa berdasarkan lastLogout user.
   */
  async isTokenBlacklisted(token: string, userId: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });

      if (!user || !user.lastLogout) return true; // If no user or lastLogout, blacklist token

      const decoded = jwt.decode(token) as jwt.JwtPayload;
      if (!decoded || !decoded.iat) return true; // If token is invalid or doesn't have 'iat', blacklist token

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
}
