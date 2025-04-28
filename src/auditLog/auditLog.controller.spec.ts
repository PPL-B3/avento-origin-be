import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogService } from "./auditLog.service";
import { AuditLogController } from "./auditLog.controller";

describe("AuditLogController", () => {
  let controller: AuditLogController;
  let mockAuditLogService: {
    addAuditLog: jest.Mock;
    getAllAuditLogs: jest.Mock;
    findAll: jest.Mock;
    count: jest.Mock;
  };

  beforeEach(async () => {
    mockAuditLogService = {
      addAuditLog: jest.fn(),
      getAllAuditLogs: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    controller = module.get<AuditLogController>(AuditLogController);
  });

  describe("getAllAuditLogs", () => {
    it("should return all audit logs (positive test)", async () => {
      const mockLogs = [
        {
          logID: "1",
          eventType: "CREATE",
          userID: "user1",
          details: "A",
          timestamp: new Date(),
          documentID: "doc1",
        },
        {
          logID: "2",
          eventType: "DELETE",
          userID: "user2",
          details: "B",
          timestamp: new Date(),
          documentID: "doc2",
        },
      ];

      mockAuditLogService.getAllAuditLogs.mockResolvedValue(mockLogs);

      const result = await controller.getAllAuditLogs();
      expect(result).toBe(mockLogs);
      expect(mockAuditLogService.getAllAuditLogs).toHaveBeenCalled();
    });

    it("should throw error when service fails (negative test)", async () => {
      mockAuditLogService.getAllAuditLogs.mockRejectedValue(
        new Error("Service error"),
      );

      await expect(controller.getAllAuditLogs()).rejects.toThrow(
        "Service error",
      );
    });
  });

  describe("searchAuditLogs", () => {
    it("should return search results with default parameters", async () => {
      const mockSearchResults = {
        data: [
          {
            logID: "1",
            eventType: "CREATE",
            userID: "user1",
            details: "A",
            timestamp: new Date(),
            documentID: "doc1",
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
        },
      };

      mockAuditLogService.findAll.mockResolvedValue(mockSearchResults);

      const result = await controller.searchAuditLogs();

      expect(result).toBe(mockSearchResults);
      expect(mockAuditLogService.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        query: undefined,
        eventType: undefined,
        startDate: undefined,
        endDate: undefined,
        userId: undefined,
      });
    });

    it("should return search results with custom parameters", async () => {
      const mockSearchResults = {
        data: [
          {
            logID: "1",
            eventType: "UPDATE",
            userID: "user1",
            details: "Updated document",
            timestamp: new Date("2023-01-15"),
            documentID: "doc1",
          },
        ],
        meta: {
          total: 1,
          page: 2,
          limit: 5,
        },
      };

      mockAuditLogService.findAll.mockResolvedValue(mockSearchResults);

      const startDate = "2023-01-01";
      const endDate = "2023-01-31";

      const result = await controller.searchAuditLogs(
        2,
        5,
        "document",
        "UPDATE",
        startDate,
        endDate,
        "user1",
      );

      expect(result).toBe(mockSearchResults);
      expect(mockAuditLogService.findAll).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        query: "document",
        eventType: "UPDATE",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        userId: "user1",
      });
    });

    it("should handle service errors during search", async () => {
      mockAuditLogService.findAll.mockRejectedValue(new Error("Search failed"));

      await expect(controller.searchAuditLogs()).rejects.toThrow(
        "Search failed",
      );
    });
  });

  describe("getAuditLogsCount", () => {
    it("should return count with no parameters", async () => {
      const mockCount = { count: 100 };
      mockAuditLogService.count.mockResolvedValue(mockCount);

      const result = await controller.getAuditLogsCount();

      expect(result).toBe(mockCount);
      expect(mockAuditLogService.count).toHaveBeenCalledWith({
        query: undefined,
        eventType: undefined,
        startDate: undefined,
        endDate: undefined,
        userId: undefined,
      });
    });

    it("should return count with filter parameters", async () => {
      const mockCount = { count: 25 };
      mockAuditLogService.count.mockResolvedValue(mockCount);

      const startDate = "2023-02-01";
      const endDate = "2023-02-28";

      const result = await controller.getAuditLogsCount(
        "important",
        "CREATE",
        startDate,
        endDate,
        "admin",
      );

      expect(result).toBe(mockCount);
      expect(mockAuditLogService.count).toHaveBeenCalledWith({
        query: "important",
        eventType: "CREATE",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        userId: "admin",
      });
    });

    it("should handle service errors when getting count", async () => {
      mockAuditLogService.count.mockRejectedValue(new Error("Count failed"));

      await expect(controller.getAuditLogsCount()).rejects.toThrow(
        "Count failed",
      );
    });
  });
});
