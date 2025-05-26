import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UserRepository } from "../interfaces/user-repository.interface";
import { User } from "@prisma/client";

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async createUser(data: {
    email: string;
    password: string;
    lastLogout: bigint;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async markLogout(id: string, timestamp: bigint): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLogout: timestamp },
    });
  }
}
