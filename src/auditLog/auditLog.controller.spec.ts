import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogService } from "./auditLog.service";
import { AuditLogController } from "./auditLog.controller";
import { SearchAuditLogDto } from "./dto/search-audit-log.dto";

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
    it("should return search results with empty DTO", async () => {
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

      // Empty DTO
      const dto = new SearchAuditLogDto();

      const result = await controller.searchAuditLogs(dto);

      expect(result).toBe(mockSearchResults);
      expect(mockAuditLogService.findAll).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
        limit: 10,
        page: 1,
      });
    });

    it("should return search results with populated DTO", async () => {
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

      const dto = new SearchAuditLogDto();
      dto.page = 2;
      dto.limit = 5;
      dto.query = "document";
      dto.eventType = "UPDATE";
      dto.startDate = "2023-01-01";
      dto.endDate = "2023-01-31";
      dto.userId = "user1";

      const result = await controller.searchAuditLogs(dto);

      expect(result).toBe(mockSearchResults);
      expect(mockAuditLogService.findAll).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        query: "document",
        eventType: "UPDATE",
        startDate: new Date("2023-01-01"),
        endDate: new Date("2023-01-31"),
        userId: "user1",
      });
    });

    it("should handle null date values", async () => {
      const mockSearchResults = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
        },
      };

      mockAuditLogService.findAll.mockResolvedValue(mockSearchResults);

      const dto = new SearchAuditLogDto();
      dto.startDate = undefined;
      dto.endDate = undefined;

      const result = await controller.searchAuditLogs(dto);

      expect(result).toBe(mockSearchResults);
      expect(mockAuditLogService.findAll).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
        limit: 10,
        page: 1,
      });
    });

    it("should handle service errors during search", async () => {
      mockAuditLogService.findAll.mockRejectedValue(new Error("Search failed"));

      await expect(
        controller.searchAuditLogs(new SearchAuditLogDto()),
      ).rejects.toThrow("Search failed");
    });
  });

  describe("getAuditLogsCount", () => {
    it("should return count with empty DTO", async () => {
      const mockCount = { count: 100 };
      mockAuditLogService.count.mockResolvedValue(mockCount);

      // Empty DTO
      const dto = new SearchAuditLogDto();

      const result = await controller.getAuditLogsCount(dto);

      expect(result).toBe(mockCount);
      expect(mockAuditLogService.count).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
        limit: 10,
        page: 1,
      });
    });

    it("should return count with populated DTO", async () => {
      const mockCount = { count: 25 };
      mockAuditLogService.count.mockResolvedValue(mockCount);

      const dto = new SearchAuditLogDto();
      dto.query = "important";
      dto.eventType = "CREATE";
      dto.startDate = "2023-02-01";
      dto.endDate = "2023-02-28";
      dto.userId = "admin";

      const result = await controller.getAuditLogsCount(dto);

      expect(result).toBe(mockCount);
      expect(mockAuditLogService.count).toHaveBeenCalledWith({
        startDate: new Date("2023-02-01"),
        endDate: new Date("2023-02-28"),
        query: "important",
        eventType: "CREATE",
        userId: "admin",
        page: 1,
        limit: 10,
      });
    });

    it("should handle service errors when getting count", async () => {
      mockAuditLogService.count.mockRejectedValue(new Error("Count failed"));

      await expect(
        controller.getAuditLogsCount(new SearchAuditLogDto()),
      ).rejects.toThrow("Count failed");
    });
  });

  describe("createAuditLog", () => {
    it("should create a new audit log entry", async () => {
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

      mockAuditLogService.addAuditLog.mockResolvedValue(expectedResult);

      const result = await controller.createAuditLog(auditLogData);

      expect(result).toBe(expectedResult);
      expect(mockAuditLogService.addAuditLog).toHaveBeenCalledWith(
        auditLogData,
      );
    });

    it("should create audit log without documentID", async () => {
      const auditLogData = {
        eventType: "LOGIN",
        userID: "user123",
        details: "User logged in",
      };

      const expectedResult = {
        logID: "1",
        ...auditLogData,
        timestamp: new Date(),
      };

      mockAuditLogService.addAuditLog.mockResolvedValue(expectedResult);

      const result = await controller.createAuditLog(auditLogData);

      expect(result).toBe(expectedResult);
      expect(mockAuditLogService.addAuditLog).toHaveBeenCalledWith(
        auditLogData,
      );
    });

    it("should handle service errors when creating audit log", async () => {
      const auditLogData = {
        eventType: "CREATE",
        userID: "user123",
        details: "Created a new document",
        documentID: "doc123",
      };

      mockAuditLogService.addAuditLog.mockRejectedValue(
        new Error("Creation failed"),
      );

      await expect(controller.createAuditLog(auditLogData)).rejects.toThrow(
        "Creation failed",
      );
    });
  });
});
