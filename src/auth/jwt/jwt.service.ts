import { Injectable } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class JwtService {
  constructor(
    private readonly prismaService: PrismaService,
    private configService: ConfigService,
  ) {}
  generateToken(payload: { userId: string; iat?: number }): string {
    const issuedAt = payload.iat ?? Number(Math.floor(Date.now() / 1000));

    return jwt.sign(
      {
        userId: payload.userId,
        iat: issuedAt,
      },
      this.configService.get<string>("JWT_SECRET", "jwt_default"),
      {
        expiresIn: "1h",
      },
    );
  }

  verifyToken(token: string): jwt.JwtPayload {
    return jwt.verify(
      token,
      this.configService.get<string>("JWT_SECRET", "jwt_default"),
    ) as jwt.JwtPayload;
  }

  async isTokenBlacklisted(token: string, userId: string): Promise<boolean> {
    try {
      const user = await this.prismaService.user.findUnique({
        where: { id: userId },
      });
      if (!user?.lastLogout) return true; // If no user or lastLogout, blacklist token
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      if (!decoded?.iat) return true; // If token is invalid or doesn't have 'iat', blacklist token
      const tokenIssuedAt = Number(decoded.iat); // Token's 'issued at' time
      const userLastLogout = Math.floor(Number(user.lastLogout) / 1000); // Convert lastLogout to seconds
      // Return true if token is issued before the lastLogout (meaning blacklisted)
      return tokenIssuedAt <= userLastLogout; // Token is blacklisted if issued before or exactly at the last logout
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return true; // In case of error, treat token as blacklisted
    }
  }
}
