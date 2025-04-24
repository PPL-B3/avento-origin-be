import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

export type AuditLogFilter = {
  startDate?: Date;
  endDate?: Date;
  eventType?: string[];
  userID?: string[];
  documentID?: string[];
  searchTerm?: string;
  page?: number;
  limit?: number;
};

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

  async getFilteredAuditLogs(filter: AuditLogFilter = {}) {
    // Default pagination values
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const skip = (page - 1) * limit;

    // Build the where clause based on filters
    const where: Prisma.AuditLogWhereInput = {};

    // Date range filtering
    if (filter.startDate || filter.endDate) {
      where.timestamp = {};

      if (filter.startDate) {
        where.timestamp.gte = filter.startDate;
      }

      if (filter.endDate) {
        where.timestamp.lte = filter.endDate;
      }
    }

    // Event type filtering
    if (filter.eventType && filter.eventType.length > 0) {
      where.eventType = {
        in: filter.eventType,
      };
    }

    // User ID filtering
    if (filter.userID && filter.userID.length > 0) {
      where.userID = {
        in: filter.userID,
      };
    }

    // Document ID filtering
    if (filter.documentID && filter.documentID.length > 0) {
      where.documentID = {
        in: filter.documentID,
      };
    }

    // Search term (searching in details field)
    if (filter.searchTerm) {
      where.details = {
        contains: filter.searchTerm,
        mode: "insensitive", // Case-insensitive search
      };
    }

    // Fetch the filtered logs
    const logs = await this.prisma.auditLog.findMany({
      where,
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
      skip,
      take: limit,
    });

    // Get the total count for pagination
    const totalCount = await this.prisma.auditLog.count({ where });

    return {
      logs,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async getEventTypes(): Promise<string[]> {
    return this.getUniqueFieldValues("eventType");
  }

  // Get all unique user IDs for filter dropdown
  async getUserIDs(): Promise<string[]> {
    return this.getUniqueFieldValues("userID");
  }

  // Get all unique document IDs for filter dropdown
  async getDocumentIDs(): Promise<string[]> {
    // exclude nulls
    return this.getUniqueFieldValues("documentID", {
      documentID: { not: null },
    });
  }

  private async getUniqueFieldValues(
    field: keyof Prisma.AuditLogWhereInput,
    where?: Prisma.AuditLogWhereInput
  ): Promise<string[]> {
    const results = await this.prisma.auditLog.findMany({
      where,
      select: { [field]: true } as any,
      distinct: [field as string],
    });
    return (results as any[])
      .map((item) => item[field])
      .filter((v): v is string => Boolean(v));
  }
}
