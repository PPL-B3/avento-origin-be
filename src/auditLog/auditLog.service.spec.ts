import { AuditLogService, AuditLogFilter } from "./auditLog.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AuditLogService", () => {
  let auditLogService: AuditLogService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const mockPrismaService = mockPrisma as unknown as PrismaService;

    auditLogService = new AuditLogService(mockPrismaService);
  });

  // Original tests
  it("should add audit log with documentID (positive test)", async () => {
    const mockLog = {
      logID: "1",
      eventType: "CREATE",
      userID: "user1",
      details: "Some details",
      documentID: "doc1",
    };

    mockPrisma.auditLog.create.mockResolvedValue(mockLog);

    const result = await auditLogService.addAuditLog({
      eventType: "CREATE",
      userID: "user1",
      details: "Some details",
      documentID: "doc1",
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        eventType: "CREATE",
        userID: "user1",
        details: "Some details",
        documentID: "doc1",
      },
    });
    expect(result).toBe(mockLog);
  });

  it("should add audit log without documentID (branch coverage)", async () => {
    const mockLog = {
      logID: "2",
      eventType: "DELETE",
      userID: "user2",
      details: "No documentID provided",
      documentID: null,
    };

    mockPrisma.auditLog.create.mockResolvedValue(mockLog);

    const result = await auditLogService.addAuditLog({
      eventType: "DELETE",
      userID: "user2",
      details: "No documentID provided",
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        eventType: "DELETE",
        userID: "user2",
        details: "No documentID provided",
        documentID: undefined,
      },
    });
    expect(result).toBe(mockLog);
  });

  it("should throw error when prisma.create fails (negative test)", async () => {
    const mockError = new Error("Database error");
    mockPrisma.auditLog.create.mockRejectedValue(mockError);

    await expect(
      auditLogService.addAuditLog({
        eventType: "ERROR",
        userID: "user3",
        details: "Something went wrong",
      }),
    ).rejects.toThrow("Database error");

    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it("should return all audit logs ordered by timestamp desc", async () => {
    const mockLogs = [{ logID: "1" }, { logID: "2" }];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);

    const result = await auditLogService.getAllAuditLogs();

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
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

    expect(result).toBe(mockLogs);
  });

  // New tests for filtering functionality

  // Test for default pagination without any filters
  it("should apply default pagination when no filters are provided", async () => {
    const mockLogs = [{ logID: "1" }, { logID: "2" }];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
    mockPrisma.auditLog.count.mockResolvedValue(2);

    const result = await auditLogService.getFilteredAuditLogs();

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {},
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
      skip: 0,
      take: 10,
    });

    expect(result).toEqual({
      logs: mockLogs,
      pagination: {
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    });
  });

  // Test for custom pagination
  it("should apply custom pagination when provided", async () => {
    const mockLogs = [{ logID: "3" }, { logID: "4" }];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
    mockPrisma.auditLog.count.mockResolvedValue(20);

    const filter: AuditLogFilter = {
      page: 2,
      limit: 5,
    };

    const result = await auditLogService.getFilteredAuditLogs(filter);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {},
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
      skip: 5, // (page-1) * limit
      take: 5,
    });

    expect(result).toEqual({
      logs: mockLogs,
      pagination: {
        total: 20,
        page: 2,
        limit: 5,
        totalPages: 4,
      },
    });
  });

  // Test for startDate filter only
  it("should apply startDate filter correctly", async () => {
    const mockLogs = [{ logID: "5" }];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const startDate = new Date("2023-01-01");
    const filter: AuditLogFilter = {
      startDate,
    };

    const result = await auditLogService.getFilteredAuditLogs(filter);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        timestamp: {
          gte: startDate,
        },
      },
      select: expect.any(Object),
      orderBy: expect.any(Object),
      skip: expect.any(Number),
      take: expect.any(Number),
    });

    expect(result.logs).toBe(mockLogs);
  });

  // Test for endDate filter only
  it("should apply endDate filter correctly", async () => {
    const mockLogs = [{ logID: "6" }];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const endDate = new Date("2023-12-31");
    const filter: AuditLogFilter = {
      endDate,
    };

    const result = await auditLogService.getFilteredAuditLogs(filter);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        timestamp: {
          lte: endDate,
        },
      },
      select: expect.any(Object),
      orderBy: expect.any(Object),
      skip: expect.any(Number),
      take: expect.any(Number),
    });

    expect(result.logs).toBe(mockLogs);
  });

  // Test for date range (both startDate and endDate)
  it("should apply date range filter correctly", async () => {
    const mockLogs = [{ logID: "7" }];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const startDate = new Date("2023-01-01");
    const endDate = new Date("2023-12-31");
    const filter: AuditLogFilter = {
      startDate,
      endDate,
    };

    const result = await auditLogService.getFilteredAuditLogs(filter);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: expect.any(Object),
      orderBy: expect.any(Object),
      skip: expect.any(Number),
      take: expect.any(Number),
    });

    expect(result.logs).toBe(mockLogs);
  });

  // Test for eventType filter
  it("should apply eventType filter correctly", async () => {
    const mockLogs = [{ logID: "8" }];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const filter: AuditLogFilter = {
      eventType: ["CREATE", "UPDATE"],
    };

    const result = await auditLogService.getFilteredAuditLogs(filter);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        eventType: {
          in: ["CREATE", "UPDATE"],
        },
      },
      select: expect.any(Object),
      orderBy: expect.any(Object),
      skip: expect.any(Number),
      take: expect.any(Number),
    });

    expect(result.logs).toBe(mockLogs);
  });

  // Test for empty eventType array
  it("should not apply eventType filter if array is empty", async () => {
    const mockLogs = [{ logID: "9" }];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const filter: AuditLogFilter = {
      eventType: [],
    };

    const result = await auditLogService.getFilteredAuditLogs(filter);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {},
      select: expect.any(Object),
      orderBy: expect.any(Object),
      skip: expect.any(Number),
      take: expect.any(Number),
    });

    expect(result.logs).toBe(mockLogs);
  });

  // Test for userID filter
  it("should apply userID filter correctly", async () => {
    const mockLogs = [{ logID: "10" }];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const filter: AuditLogFilter = {
      userID: ["user1", "user2"],
    };

    const result = await auditLogService.getFilteredAuditLogs(filter);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        userID: {
          in: ["user1", "user2"],
        },
      },
      select: expect.any(Object),
      orderBy: expect.any(Object),
      skip: expect.any(Number),
      take: expect.any(Number),
    });

    expect(result.logs).toBe(mockLogs);
  });

  // Test for empty userID array
  it("should not apply userID filter if array is empty", async () => {
    const mockLogs = [{ logID: "11" }];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const filter: AuditLogFilter = {
      userID: [],
    };

    const result = await auditLogService.getFilteredAuditLogs(filter);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {},
      select: expect.any(Object),
      orderBy: expect.any(Object),
      skip: expect.any(Number),
      take: expect.any(Number),
    });

    expect(result.logs).toBe(mockLogs);
  });

  // Test for documentID filter
  it("should apply documentID filter correctly", async () => {
    const mockLogs = [{ logID: "12" }];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const filter: AuditLogFilter = {
      documentID: ["doc1", "doc2"],
    };

    const result = await auditLogService.getFilteredAuditLogs(filter);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        documentID: {
          in: ["doc1", "doc2"],
        },
      },
      select: expect.any(Object),
      orderBy: expect.any(Object),
      skip: expect.any(Number),
      take: expect.any(Number),
    });

    expect(result.logs).toBe(mockLogs);
  });

  // Test for empty documentID array
  it("should not apply documentID filter if array is empty", async () => {
    const mockLogs = [{ logID: "13" }];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const filter: AuditLogFilter = {
      documentID: [],
    };

    const result = await auditLogService.getFilteredAuditLogs(filter);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {},
      select: expect.any(Object),
      orderBy: expect.any(Object),
      skip: expect.any(Number),
      take: expect.any(Number),
    });

    expect(result.logs).toBe(mockLogs);
  });

  // Test for searchTerm filter
  it("should apply searchTerm filter correctly", async () => {
    const mockLogs = [{ logID: "14" }];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const filter: AuditLogFilter = {
      searchTerm: "important",
    };

    const result = await auditLogService.getFilteredAuditLogs(filter);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        details: {
          contains: "important",
          mode: "insensitive",
        },
      },
      select: expect.any(Object),
      orderBy: expect.any(Object),
      skip: expect.any(Number),
      take: expect.any(Number),
    });

    expect(result.logs).toBe(mockLogs);
  });

  // Test for multiple filters combined
  it("should apply multiple filters correctly", async () => {
    const mockLogs = [{ logID: "15" }];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const startDate = new Date("2023-01-01");
    const endDate = new Date("2023-12-31");
    const filter: AuditLogFilter = {
      startDate,
      endDate,
      eventType: ["CREATE"],
      userID: ["user1"],
      documentID: ["doc1"],
      searchTerm: "important",
      page: 2,
      limit: 5,
    };

    const result = await auditLogService.getFilteredAuditLogs(filter);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
        eventType: {
          in: ["CREATE"],
        },
        userID: {
          in: ["user1"],
        },
        documentID: {
          in: ["doc1"],
        },
        details: {
          contains: "important",
          mode: "insensitive",
        },
      },
      select: expect.any(Object),
      orderBy: expect.any(Object),
      skip: 5,
      take: 5,
    });

    expect(result.logs).toBe(mockLogs);
  });

  // Tests for the helper methods to get filter options

  it("should get all unique event types", async () => {
    const mockEventTypes = [
      { eventType: "CREATE" },
      { eventType: "UPDATE" },
      { eventType: "DELETE" },
    ];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockEventTypes);

    const result = await auditLogService.getEventTypes();

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      select: {
        eventType: true,
      },
      distinct: ["eventType"],
    });

    expect(result).toEqual(["CREATE", "UPDATE", "DELETE"]);
  });

  it("should get all unique user IDs", async () => {
    const mockUserIDs = [
      { userID: "user1" },
      { userID: "user2" },
      { userID: "user3" },
    ];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockUserIDs);

    const result = await auditLogService.getUserIDs();

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      select: {
        userID: true,
      },
      distinct: ["userID"],
    });

    expect(result).toEqual(["user1", "user2", "user3"]);
  });

  it("should get all unique document IDs", async () => {
    const mockDocumentIDs = [
      { documentID: "doc1" },
      { documentID: "doc2" },
      { documentID: null },
    ];
    mockPrisma.auditLog.findMany.mockResolvedValue(mockDocumentIDs);

    const result = await auditLogService.getDocumentIDs();

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        documentID: {
          not: null,
        },
      },
      select: {
        documentID: true,
      },
      distinct: ["documentID"],
    });

    expect(result).toEqual(["doc1", "doc2"]);
  });
});
