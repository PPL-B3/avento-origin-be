import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, Role } from "@prisma/client";

interface PaginationParams {
  page?: number;
  limit?: number;
  query?: string;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  documentName?: string; // Added document name parameter
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
      documentName,
    } = params;
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(
      query,
      eventType,
      startDate,
      endDate,
      userId,
      documentName,
    );

    // Ambil audit logs seperti biasa
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
            documentID: true,
            filePath: true,
            uploadDate: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    // Hitung total logs untuk pagination
    const total = await this.prisma.auditLog.count({ where });

    // Jika tidak ada audit logs, kembalikan data kosong
    if (auditLogs.length === 0) {
      return {
        data: [],
        meta: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }

    const userIds = [...new Set(auditLogs.map((log) => log.userID))];

    let users: { id: string; email: string; role: Role }[] = [];

    if (userIds.length > 0) {
      // Ambil data pengguna untuk semua userID tersebut dalam satu query
      users = await this.prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        select: {
          id: true,
          email: true,
          role: true,
        },
      });
    }

    // Buat map untuk pengambilan data user yang lebih efisien
    const userMap = new Map(users.map((user) => [user.id, user]));

    // Gabungkan data audit log dengan data pengguna
    const enrichedAuditLogs = auditLogs.map((log) => {
      const user = userMap.get(log.userID);
      return {
        ...log,
        user: user || null,
      };
    });

    return {
      data: enrichedAuditLogs,
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
    const { query, eventType, startDate, endDate, userId, documentName } =
      params;

    const where = this.buildWhereClause(
      query,
      eventType,
      startDate,
      endDate,
      userId,
      documentName, // Pass document name to where clause builder
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
    documentName?: string, // Added document name parameter
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

    // Filter by document name - new filter
    if (documentName) {
      where.document = {
        documentName: {
          contains: documentName,
          mode: "insensitive",
        },
      };
    }

    return where;
  }
}
