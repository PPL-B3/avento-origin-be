import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { DeepMockProxy, mockDeep } from "jest-mock-extended";
import { PrismaClient } from "@prisma/client";
import { AuditLogService } from "./auditLog.service";

describe("AuditLogService", () => {
  let service: AuditLogService;
  let prismaService: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    const prismaServiceMock = mockDeep<PrismaClient>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("addAuditLog", () => {
    it("should create a new audit log successfully", async () => {
      // Arrange
      const auditLogData = {
        eventType: "CREATE",
        userID: "user123",
        details: "Created a new document",
        documentID: "doc123",
      };

      const expectedResult = {
        logID: "1",
        ...auditLogData,
        timestamp: new Date(),
      };

      prismaService.auditLog.create.mockResolvedValue(expectedResult);

      // Act
      const result = await service.addAuditLog(auditLogData);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: auditLogData,
      });
    });

    it("should throw error when prisma create fails", async () => {
      // Arrange
      const auditLogData = {
        eventType: "CREATE",
        userID: "user123",
        details: "Created a new document",
        documentID: "doc123",
      };

      const expectedError = new Error("Database error");
      prismaService.auditLog.create.mockRejectedValue(expectedError);

      // Act & Assert
      await expect(service.addAuditLog(auditLogData)).rejects.toThrow(
        expectedError,
      );
      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: auditLogData,
      });
    });

    it("should create a new audit log without documentID", async () => {
      // Arrange
      const auditLogData = {
        eventType: "LOGIN",
        userID: "user123",
        details: "User logged in",
      };

      const expectedResult = {
        logID: "1",
        ...auditLogData,
        documentID: null,
        timestamp: new Date(),
      };

      prismaService.auditLog.create.mockResolvedValue(expectedResult);

      // Act
      const result = await service.addAuditLog(auditLogData);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: auditLogData,
      });
    });
  });

  describe("getAllAuditLogs", () => {
    it("should return all audit logs ordered by timestamp desc", async () => {
      // Arrange
      const mockLogs = [
        {
          logID: "1",
          eventType: "CREATE",
          timestamp: new Date("2023-01-02"),
          userID: "user1",
          documentID: "doc1",
          details: "details1",
        },
        {
          logID: "2",
          eventType: "UPDATE",
          timestamp: new Date("2023-01-01"),
          userID: "user2",
          documentID: "doc2",
          details: "details2",
        },
      ];

      prismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      // Act
      const result = await service.getAllAuditLogs();

      // Assert
      expect(result).toEqual(mockLogs);
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
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
    });
  });

  describe("findAll", () => {
    it("should return paginated audit logs with default params", async () => {
      // Arrange
      const mockLogs = [
        {
          logID: "1",
          eventType: "CREATE",
          timestamp: new Date(),
          userID: "user1",
          documentID: "doc1",
          details: "details1",
          document: {
            documentName: "Document 1",
            publisher: "Publisher 1",
          },
        },
      ];

      prismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      prismaService.auditLog.count.mockResolvedValue(1);

      // Act
      const result = await service.findAll({});

      // Assert
      expect(result).toEqual({
        data: mockLogs,
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
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
    });

    it("should handle pagination parameters correctly", async () => {
      // Arrange
      const mockLogs = [
        {
          logID: "1",
          eventType: "CREATE",
          timestamp: new Date(),
          userID: "user1",
          documentID: "doc1",
          details: "details1",
          document: {
            documentName: "Document 1",
            publisher: "Publisher 1",
          },
        },
      ];

      prismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      prismaService.auditLog.count.mockResolvedValue(30);

      // Act
      const result = await service.findAll({ page: 3, limit: 10 });

      // Assert
      expect(result).toEqual({
        data: mockLogs,
        meta: {
          total: 30,
          page: 3,
          limit: 10,
          totalPages: 3,
        },
      });

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 20,
        take: 10,
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
    });

    it("should filter by query string searching across multiple fields", async () => {
      // Arrange
      const mockLogs = [];
      prismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      prismaService.auditLog.count.mockResolvedValue(0);

      // Act
      const result = await service.findAll({ query: "searchTerm" });

      // Assert
      const expectedWhereClause = {
        OR: [
          { eventType: { contains: "searchTerm", mode: "insensitive" } },
          { userID: { contains: "searchTerm", mode: "insensitive" } },
          { details: { contains: "searchTerm", mode: "insensitive" } },
          {
            document: {
              documentName: { contains: "searchTerm", mode: "insensitive" },
            },
          },
        ],
      };

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhereClause,
        }),
      );
    });

    it("should filter by valid date in query string", async () => {
      // Arrange
      const mockLogs = [];
      prismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      prismaService.auditLog.count.mockResolvedValue(0);

      const dateString = "2023-01-01";
      const searchDate = new Date(dateString);

      const startOfDay = new Date(searchDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(searchDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Act
      const result = await service.findAll({ query: dateString });

      // Assert
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { eventType: { contains: dateString, mode: "insensitive" } },
              { userID: { contains: dateString, mode: "insensitive" } },
              { details: { contains: dateString, mode: "insensitive" } },
              {
                document: {
                  documentName: { contains: dateString, mode: "insensitive" },
                },
              },
              {
                timestamp: {
                  gte: startOfDay,
                  lte: endOfDay,
                },
              },
            ],
          },
        }),
      );
    });

    it("should filter by eventType", async () => {
      // Arrange
      const mockLogs = [];
      prismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      prismaService.auditLog.count.mockResolvedValue(0);

      // Act
      const result = await service.findAll({ eventType: "CREATE" });

      // Assert
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            eventType: "CREATE",
          },
        }),
      );
    });

    it("should filter by date range with startDate only", async () => {
      // Arrange
      const mockLogs = [];
      prismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      prismaService.auditLog.count.mockResolvedValue(0);

      const startDate = new Date("2023-01-01");

      // Act
      const result = await service.findAll({ startDate });

      // Assert
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            timestamp: {
              gte: startDate,
            },
          },
        }),
      );
    });

    it("should filter by date range with endDate only", async () => {
      // Arrange
      const mockLogs = [];
      prismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      prismaService.auditLog.count.mockResolvedValue(0);

      const endDate = new Date("2023-01-31");

      // Act
      const result = await service.findAll({ endDate });

      // Assert
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            timestamp: {
              lte: endDate,
            },
          },
        }),
      );
    });

    it("should filter by date range with both startDate and endDate", async () => {
      // Arrange
      const mockLogs = [];
      prismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      prismaService.auditLog.count.mockResolvedValue(0);

      const startDate = new Date("2023-01-01");
      const endDate = new Date("2023-01-31");

      // Act
      const result = await service.findAll({ startDate, endDate });

      // Assert
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
      );
    });

    it("should filter by userId", async () => {
      // Arrange
      const mockLogs = [];
      prismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      prismaService.auditLog.count.mockResolvedValue(0);

      // Act
      const result = await service.findAll({ userId: "user123" });

      // Assert
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userID: "user123",
          },
        }),
      );
    });

    // New test case for document name filter
    it("should filter by documentName", async () => {
      // Arrange
      const mockLogs = [];
      prismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      prismaService.auditLog.count.mockResolvedValue(0);

      // Act
      const result = await service.findAll({ documentName: "report" });

      // Assert
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            document: {
              documentName: {
                contains: "report",
                mode: "insensitive",
              },
            },
          },
        }),
      );
    });

    it("should apply all filters together when provided", async () => {
      // Arrange
      const mockLogs = [];
      prismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      prismaService.auditLog.count.mockResolvedValue(0);

      const query = "search";
      const eventType = "UPDATE";
      const startDate = new Date("2023-01-01");
      const endDate = new Date("2023-01-31");
      const userId = "user123";
      const documentName = "report"; // Add document name

      // Act
      const result = await service.findAll({
        query,
        eventType,
        startDate,
        endDate,
        userId,
        documentName, // Include documentName in test
      });

      // Assert
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { eventType: { contains: query, mode: "insensitive" } },
              { userID: { contains: query, mode: "insensitive" } },
              { details: { contains: query, mode: "insensitive" } },
              {
                document: {
                  documentName: { contains: query, mode: "insensitive" },
                },
              },
            ],
            eventType,
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
            userID: userId,
            document: {
              documentName: {
                contains: documentName,
                mode: "insensitive",
              },
            },
          },
        }),
      );
    });
  });

  describe("count", () => {
    it("should return count of audit logs with no filters", async () => {
      // Arrange
      prismaService.auditLog.count.mockResolvedValue(10);

      // Act
      const result = await service.count({});

      // Assert
      expect(result).toEqual({ count: 10 });
      expect(prismaService.auditLog.count).toHaveBeenCalledWith({
        where: {},
      });
    });

    it("should apply query filter to count", async () => {
      // Arrange
      prismaService.auditLog.count.mockResolvedValue(5);

      // Act
      const result = await service.count({ query: "searchTerm" });

      // Assert
      const expectedWhereClause = {
        OR: [
          { eventType: { contains: "searchTerm", mode: "insensitive" } },
          { userID: { contains: "searchTerm", mode: "insensitive" } },
          { details: { contains: "searchTerm", mode: "insensitive" } },
          {
            document: {
              documentName: { contains: "searchTerm", mode: "insensitive" },
            },
          },
        ],
      };

      expect(prismaService.auditLog.count).toHaveBeenCalledWith({
        where: expectedWhereClause,
      });
    });

    it("should apply eventType filter to count", async () => {
      // Arrange
      prismaService.auditLog.count.mockResolvedValue(3);

      // Act
      const result = await service.count({ eventType: "CREATE" });

      // Assert
      expect(prismaService.auditLog.count).toHaveBeenCalledWith({
        where: {
          eventType: "CREATE",
        },
      });
    });

    it("should apply date range filters to count", async () => {
      // Arrange
      prismaService.auditLog.count.mockResolvedValue(2);

      const startDate = new Date("2023-01-01");
      const endDate = new Date("2023-01-31");

      // Act
      const result = await service.count({ startDate, endDate });

      // Assert
      expect(prismaService.auditLog.count).toHaveBeenCalledWith({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
    });

    it("should apply userId filter to count", async () => {
      // Arrange
      prismaService.auditLog.count.mockResolvedValue(2);

      // Act
      const result = await service.count({ userId: "user123" });

      // Assert
      expect(prismaService.auditLog.count).toHaveBeenCalledWith({
        where: {
          userID: "user123",
        },
      });
    });

    // New test case for document name filter
    it("should apply documentName filter to count", async () => {
      // Arrange
      prismaService.auditLog.count.mockResolvedValue(3);

      // Act
      const result = await service.count({ documentName: "report" });

      // Assert
      expect(prismaService.auditLog.count).toHaveBeenCalledWith({
        where: {
          document: {
            documentName: {
              contains: "report",
              mode: "insensitive",
            },
          },
        },
      });
    });

    it("should apply all filters together to count when provided", async () => {
      // Arrange
      prismaService.auditLog.count.mockResolvedValue(1);

      const query = "search";
      const eventType = "UPDATE";
      const startDate = new Date("2023-01-01");
      const endDate = new Date("2023-01-31");
      const userId = "user123";
      const documentName = "report"; // Added document name

      // Act
      const result = await service.count({
        query,
        eventType,
        startDate,
        endDate,
        userId,
        documentName, // Include documentName in test
      });

      // Assert
      expect(prismaService.auditLog.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { eventType: { contains: query, mode: "insensitive" } },
            { userID: { contains: query, mode: "insensitive" } },
            { details: { contains: query, mode: "insensitive" } },
            {
              document: {
                documentName: { contains: query, mode: "insensitive" },
              },
            },
          ],
          eventType,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
          userID: userId,
          document: {
            documentName: {
              contains: documentName,
              mode: "insensitive",
            },
          },
        },
      });
    });
  });
});
