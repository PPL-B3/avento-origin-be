import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthDto } from "../dto";
import * as argon from "argon2";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { JwtService } from "../jwt/jwt.service";
import { AuditLogService } from "../../auditLog/auditLog.service";
import { PasswordPolicy } from "../interfaces/password-policy.interface";

@Injectable()
export class AuthService {
  constructor(
    @Inject("PasswordPolicy") private readonly policy: PasswordPolicy,
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Menandai token sebagai tidak valid dengan menyimpan timestamp logout di database.
   */
  async logout(userId: string): Promise<{ success: boolean; message: string }> {
    if (!userId) {
      throw new BadRequestException("User ID harus diisi");
    }

    try {
      const user = await this.prismaService.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user) {
        throw new BadRequestException("Gagal Logout");
      }

      await this.prismaService.user.update({
        where: { id: userId },
        data: { lastLogout: BigInt(Date.now()) },
      });

      try {
        await this.auditLogService.addAuditLog({
          eventType: "LOGOUT",
          userID: userId,
          details: `User with email ${user.email} logged out.`,
        });
      } catch (err) {
        console.error("Audit log failed:", err); // Log saja, jangan ganggu logout
      }

      return {
        success: true,
        message: "Berhasil logout",
      };
    } catch {
      return {
        success: false,
        message: "Gagal logout",
      };
    }
  }

  async register(dto: AuthDto) {
    this.policy.validate(dto.password);
    const hash = await argon.hash(dto.password);
    try {
      const user = await this.prismaService.user.create({
        data: {
          email: dto.email,
          password: hash,
          lastLogout: BigInt(Date.now()),
        },
      });

      return {
        id: user.id,
        email: user.email,
        role: user.role,
      };
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
          throw new ForbiddenException("Email has already been registered");
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
      throw new ForbiddenException("Username or password is incorrect");
    }

    const passwordMatches = await argon.verify(user.password, dto.password);
    if (!passwordMatches) {
      throw new ForbiddenException("Username or password is incorrect");
    }

    const token = this.jwtService.generateToken({ userId: user.id });

    await this.auditLogService.addAuditLog({
      eventType: "LOGIN",
      userID: user.id,
      details: `User with email ${user.email} logged in.`,
    });

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
