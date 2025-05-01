import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminSeederService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async onModuleInit() {
    // Admin seeding functionality has been moved to prisma/seed.ts
    // and is now only executed in production environment
    // This service is kept as a placeholder for backward compatibility
    
    const environment = this.config.get<string>("NODE_ENV") ?? "development";
    
    if (environment !== "production") {
      console.log("Admin seeding is only performed in production environment");
      console.log("For local development, use prisma db seed command");
    } else {
      console.log("Admin seeding is handled by prisma/seed.ts in production");
    }
  }
}
