import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { JwtService } from "../jwt.service";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Token tidak ditemukan");
    }

    const token = authHeader.replace("Bearer ", "").trim();

    try {
      const decoded = this.jwtService.verifyToken(token);
      const userId = decoded.userId;

      // Check if the token is blacklisted before proceeding further
      const isBlacklisted = await this.jwtService.isTokenBlacklisted(
        token,
        userId
      );
      if (isBlacklisted) {
        throw new UnauthorizedException(
          "Token sudah tidak berlaku (sudah logout)"
        );
      }

      req["user"] = {
        userId,
        iat: Number(decoded.iat),
      };

      next();
    } catch (error) {
      // Only throw a generic error if it's not related to the blacklisting
      if (!(error instanceof UnauthorizedException)) {
        throw new UnauthorizedException("Token tidak valid atau sudah expired");
      }
      throw error;
    }
  }
}
