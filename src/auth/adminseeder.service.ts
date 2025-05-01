import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import * as argon2 from "argon2";

@Injectable()
export class AdminSeederService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async onModuleInit() {
    // Admin is now seeded through prisma/seed.ts
    // This service is kept for backward compatibility
    // and for environments that might need dynamic admin creation based on env vars

    const email = this.config.get<string>("ADMIN_EMAIL");
    const password = this.config.get<string>("ADMIN_PASSWORD");
    if (!email || !password) {
      console.warn(
        "ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping admin seeding"
      );
      return;
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`Admin user already exists: ${email}`);
      return;
    }

    const hash = await argon2.hash(password);
    await this.prisma.user.create({
      data: {
        email,
        password: hash,
        role: "ADMIN",
        lastLogout: BigInt(Date.now()),
      },
    });
    console.log(`✅ Created admin user from environment variables: ${email}`);
  }
}
