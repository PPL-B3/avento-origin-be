import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogService } from "./auditLog.service";
import { AuditLogController } from "./auditLog.controller";
import { JwtAuthMiddleware } from "../auth/jwt/middleware/jwt-auth.middleware";
import { RolesGuard } from "../auth/roles.guard";
import { JwtService } from "../auth/jwt/jwt.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

describe("AuditLogController", () => {
  let controller: AuditLogController;
  let mockAuditLogService: {
    addAuditLog: jest.Mock;
    getAllAuditLogs: jest.Mock;
  };

  beforeEach(async () => {
    mockAuditLogService = {
      addAuditLog: jest.fn(),
      getAllAuditLogs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: JwtAuthMiddleware,
          useValue: { use: (_req, _res, next) => next() },
        },
        {
          provide: RolesGuard,
          useValue: { canActivate: () => true },
        },
        {
          provide: JwtService,
          useValue: {},
        },
        {
          provide: PrismaService,
          useValue: {},
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
});
