import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

interface PaginationParams {
  page?: number;
  limit?: number;
  query?: string;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  // Fungsi untuk menambahkan audit log baru
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

  // Fungsi untuk mendapatkan semua audit log tanpa pagination (versi original)
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

  // Fungsi untuk mencari audit log dengan pagination dan filter
  async findAll(params: PaginationParams) {
    const {
      page = 1,
      limit = 10,
      query,
      eventType,
      startDate,
      endDate,
      userId,
    } = params;
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(
      query,
      eventType,
      startDate,
      endDate,
      userId,
    );

    const auditLogs = await this.prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      select: {
        logID: true,
        eventType: true,
        timestamp: true,
        userID: true,
        documentID: true,
        details: true,
        document: {
          select: {
            documentName: true,
            publisher: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    const total = await this.prisma.auditLog.count({ where });

    return {
      data: auditLogs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Fungsi untuk menghitung jumlah audit log berdasarkan filter
  async count(params: PaginationParams) {
    const { query, eventType, startDate, endDate, userId } = params;

    const where = this.buildWhereClause(
      query,
      eventType,
      startDate,
      endDate,
      userId,
    );

    const count = await this.prisma.auditLog.count({ where });

    return { count };
  }

  // Fungsi untuk membangun clause WHERE untuk pencarian
  private buildWhereClause(
    query?: string,
    eventType?: string,
    startDate?: Date,
    endDate?: Date,
    userId?: string,
  ): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};

    // Handle search query across multiple fields
    if (query) {
      // Coba parse query sebagai tanggal jika formatnya sesuai
      const possibleDate = new Date(query);
      const isValidDate = !isNaN(possibleDate.getTime());

      where.OR = [
        { eventType: { contains: query, mode: "insensitive" } },
        { userID: { contains: query, mode: "insensitive" } },
        { details: { contains: query, mode: "insensitive" } },
        {
          document: { documentName: { contains: query, mode: "insensitive" } },
        },
      ];

      // Jika query tampak seperti tanggal yang valid, tambahkan ke pencarian
      if (isValidDate) {
        // Tentukan rentang tanggal untuk satu hari
        const startOfDay = new Date(possibleDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(possibleDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Tambahkan pencarian berdasarkan tanggal
        where.OR.push({
          timestamp: {
            gte: startOfDay,
            lte: endOfDay,
          },
        });
      }
    }

    // Filter by event type
    if (eventType) {
      where.eventType = eventType;
    }

    // Filter by date range
    if (startDate || endDate) {
      where.timestamp = {};

      if (startDate) {
        where.timestamp.gte = startDate;
      }

      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    // Filter by user ID
    if (userId) {
      where.userID = userId;
    }

    return where;
  }
}
