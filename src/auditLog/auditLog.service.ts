import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async addAuditLog({
    eventType,
    userID,
    details,
    documentID,
  }: {
    eventType: string;
    userID: string;
    details: string;
    documentID?: string;
  }) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          eventType,
          userID,
          details,
          documentID,
        },
      });
    } catch (error) {
      console.error("Failed to add audit log:", error);
      throw error;
    }
  }

  async getAllAuditLogs() {
    return this.prisma.auditLog.findMany({
      select: {
        logID: true,
        eventType: true,
        timestamp: true,
        userID: true,
        documentID: true,
        details: true,
      },
      orderBy: {
        timestamp: "desc",
      },
    });
  }
}
