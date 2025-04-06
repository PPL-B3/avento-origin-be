import { addAuditLog } from "./auditLog.service";

jest.mock("@prisma/client", () => {
  const mockPrisma = {
    auditLog: {
      create: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
    prisma: mockPrisma,
  };
});

describe("addAuditLog", () => {
  const mockPrisma = require("@prisma/client").prisma;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should add audit log with documentID (positive test)", async () => {
    const mockLog = {
      id: "1",
      eventType: "CREATE",
      userID: "user1",
      details: "Some details",
      documentID: "doc1",
    };

    mockPrisma.auditLog.create.mockResolvedValue(mockLog);

    const result = await addAuditLog({
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
      id: "2",
      eventType: "DELETE",
      userID: "user2",
      details: "No documentID provided",
      documentID: null,
    };

    mockPrisma.auditLog.create.mockResolvedValue(mockLog);

    const result = await addAuditLog({
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
      addAuditLog({
        eventType: "ERROR",
        userID: "user3",
        details: "Something went wrong",
      }),
    ).rejects.toThrow("Database error");

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });
});
