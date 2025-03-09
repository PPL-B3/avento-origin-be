import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthDto } from "./dto";
import * as argon from "argon2";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { JwtService } from "./jwt/jwt.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Menandai token sebagai tidak valid dengan menyimpan timestamp logout di database.
   */
  async logout(userId: string): Promise<{ success: boolean; message: string }> {
    if (!userId) {
      throw new BadRequestException("User ID harus diisi");
    }

    try {
      await this.prismaService.user.update({
        where: { id: userId },
        data: { lastLogout: BigInt(Date.now()) },
      });

      return {
        success: true,
        message: "Berhasil logout",
      };
    } catch (error) {
      return {
        success: false,
        message: "Gagal logout",
      };
    }
  }



  async register(dto: AuthDto) {
    const hash = await argon.hash(dto.password);
    try {
      const user = await this.prismaService.user.create({
        data: {
          email: dto.email,
          password: hash,
          role: "user",
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
