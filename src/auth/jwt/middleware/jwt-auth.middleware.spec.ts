import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { JwtAuthMiddleware } from "./jwt-auth.middleware";
import { JwtService } from "../jwt.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { Request, Response } from "express";

describe("JwtAuthMiddleware", () => {
  let middleware: JwtAuthMiddleware;
  let jwtService: JwtService;
  let prismaService: PrismaService;

  // Mock services
  const mockJwtService = {
    verifyToken: jest.fn(),
    isTokenBlacklisted: jest.fn(),
  };

  const mockPrismaService = {};

  // Mock request, response, and next function
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthMiddleware,
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    middleware = module.get<JwtAuthMiddleware>(JwtAuthMiddleware);
    jwtService = module.get<JwtService>(JwtService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset mocks for each test
    mockRequest = {};
    mockResponse = {};
    mockNext = jest.fn();
  });

  describe("use", () => {
    it("should throw UnauthorizedException when Authorization header is missing", async () => {
      // Arrange
      mockRequest = {
        headers: {},
      };

      // Act & Assert
      await expect(
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(new UnauthorizedException("Token tidak ditemukan"));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when Authorization header does not start with "Bearer "', async () => {
      // Arrange
      mockRequest = {
        headers: {
          authorization: "Basic token123",
        },
      };

      // Act & Assert
      await expect(
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(new UnauthorizedException("Token tidak ditemukan"));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException with generic message when token verification fails", async () => {
      // Arrange
      mockRequest = {
        headers: {
          authorization: "Bearer token123",
        },
      };

      mockJwtService.verifyToken.mockImplementation(() => {
        throw new Error("Token verification failed");
      });

      // Act & Assert
      await expect(
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(
        new UnauthorizedException("Token tidak valid atau sudah expired"),
      );
      expect(mockJwtService.verifyToken).toHaveBeenCalledWith("token123");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException with generic message when token is blacklisted", async () => {
      // Arrange
      mockRequest = {
        headers: {
          authorization: "Bearer token123",
        },
      };

      const decodedToken = { userId: "user123", iat: 1234567890 };
      mockJwtService.verifyToken.mockReturnValue(decodedToken);

      // Simulate isTokenBlacklisted throwing the specific error
      mockJwtService.isTokenBlacklisted.mockImplementation(() => {
        throw new UnauthorizedException(
          "Token sudah tidak berlaku (sudah logout)",
        );
      });

      // Act & Assert
      await expect(
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(
        new UnauthorizedException("Token sudah tidak berlaku (sudah logout)"),
      );

      expect(mockJwtService.verifyToken).toHaveBeenCalledWith("token123");
      expect(mockJwtService.isTokenBlacklisted).toHaveBeenCalledWith(
        "token123",
        "user123",
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException with generic message when isTokenBlacklisted returns true", async () => {
      // Arrange
      mockRequest = {
        headers: {
          authorization: "Bearer token123",
        },
      };

      const decodedToken = { userId: "user123", iat: 1234567890 };
      mockJwtService.verifyToken.mockReturnValue(decodedToken);
      mockJwtService.isTokenBlacklisted.mockResolvedValue(true);

      // Act & Assert
      await expect(
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(
        new UnauthorizedException("Token sudah tidak berlaku (sudah logout)"),
      );

      expect(mockJwtService.verifyToken).toHaveBeenCalledWith("token123");
      expect(mockJwtService.isTokenBlacklisted).toHaveBeenCalledWith(
        "token123",
        "user123",
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should proceed to next middleware when token is valid and not blacklisted", async () => {
      // Arrange
      mockRequest = {
        headers: {
          authorization: "Bearer token123",
        },
      };

      const decodedToken = { userId: "user123", iat: 1234567890 };
      mockJwtService.verifyToken.mockReturnValue(decodedToken);
      mockJwtService.isTokenBlacklisted.mockResolvedValue(false);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockJwtService.verifyToken).toHaveBeenCalledWith("token123");
      expect(mockJwtService.isTokenBlacklisted).toHaveBeenCalledWith(
        "token123",
        "user123",
      );
      expect(mockRequest["user"]).toEqual({
        userId: "user123",
        iat: 1234567890,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle token with extra whitespace", async () => {
      // Arrange
      mockRequest = {
        headers: {
          authorization: "Bearer  token123  ",
        },
      };

      const decodedToken = { userId: "user123", iat: 1234567890 };
      mockJwtService.verifyToken.mockReturnValue(decodedToken);
      mockJwtService.isTokenBlacklisted.mockResolvedValue(false);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockJwtService.verifyToken).toHaveBeenCalledWith("token123");
      expect(mockJwtService.isTokenBlacklisted).toHaveBeenCalledWith(
        "token123",
        "user123",
      );
      expect(mockRequest["user"]).toEqual({
        userId: "user123",
        iat: 1234567890,
      });
      expect(mockNext).toHaveBeenCalled();
    });

  });
});
