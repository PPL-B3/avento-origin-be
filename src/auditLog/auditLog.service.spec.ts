import { AuditLogService } from "./auditLog.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AuditLogService", () => {
  let auditLogService: AuditLogService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const mockPrismaService = mockPrisma as unknown as PrismaService;

    auditLogService = new AuditLogService(mockPrismaService);
  });

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);

    const result = await auditLogService.getAllAuditLogs();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
});
