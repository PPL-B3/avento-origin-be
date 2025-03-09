import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "./jwt.service";
import { PrismaService } from "../../prisma/prisma.service";
import * as jwt from "jsonwebtoken";

// Mock the jsonwebtoken module
jest.mock("jsonwebtoken");

// Mock the PrismaService
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
  },
};

describe("JwtService", () => {
  let service: JwtService;
  let prismaService: PrismaService;
  const mockJwtSecret = "test_secret";

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Set the JWT_SECRET environment variable for testing
    process.env.JWT_SECRET = mockJwtSecret;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<JwtService>(JwtService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    // Clean up environment variable after tests
    delete process.env.JWT_SECRET;
  });

  describe("generateToken", () => {
    it("should generate a token with provided userId and iat", () => {
      // Arrange
      const payload = { userId: "user123", iat: 1234567890 };
      const mockToken = "mock.jwt.token";
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      // Act
      const result = service.generateToken(payload);

      // Assert
      expect(result).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: "user123", iat: 1234567890 },
        mockJwtSecret,
        { expiresIn: "1h" },
      );
    });

    it("should generate a token with provided userId and current time if iat is not provided", () => {
      // Arrange
      const payload = { userId: "user123" };
      const mockToken = "mock.jwt.token";
      const mockDate = 1234567890;
      jest.spyOn(Date, "now").mockReturnValue(mockDate * 1000);
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      // Act
      const result = service.generateToken(payload);

      // Assert
      expect(result).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: "user123", iat: mockDate },
        mockJwtSecret,
        { expiresIn: "1h" },
      );
    });

    it("should use default JWT_SECRET if environment variable is not set", () => {
      // Arrange
      delete process.env.JWT_SECRET;
      const payload = { userId: "user123", iat: 1234567890 };
      const mockToken = "mock.jwt.token";
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      // Re-instantiate service with default secret
      const service = new JwtService(prismaService as any);

      // Act
      const result = service.generateToken(payload);

      // Assert
      expect(result).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: "user123", iat: 1234567890 },
        "default_secret",
        { expiresIn: "1h" },
      );
    });
  });

  describe("verifyToken", () => {
    it("should verify and return the payload of a valid token", () => {
      // Arrange
      const token = "valid.jwt.token";
      const decodedPayload = { userId: "user123", iat: 1234567890 };
      (jwt.verify as jest.Mock).mockReturnValue(decodedPayload);

      // Act
      const result = service.verifyToken(token);

      // Assert
      expect(result).toEqual(decodedPayload);
      expect(jwt.verify).toHaveBeenCalledWith(token, mockJwtSecret);
    });

    it("should throw an error when token is invalid", () => {
      // Arrange
      const token = "invalid.jwt.token";
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error("invalid token");
      });

      // Act & Assert
      expect(() => service.verifyToken(token)).toThrow();
      expect(jwt.verify).toHaveBeenCalledWith(token, mockJwtSecret);
    });
  });

  describe("isTokenBlacklisted", () => {
    const mockUserId = "user123";
    const mockToken = "valid.jwt.token";

    it("should return true if user is not found", async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.isTokenBlacklisted(mockToken, mockUserId);

      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
      });
    });

    it("should return true if user does not have lastLogout", async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: mockUserId,
        lastLogout: null,
      });

      // Act
      const result = await service.isTokenBlacklisted(mockToken, mockUserId);

      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
      });
    });

    it("should return true if decoded token does not have iat", async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: mockUserId,
        lastLogout: new Date(),
      });
      (jwt.decode as jest.Mock).mockReturnValue({ userId: mockUserId });

      // Act
      const result = await service.isTokenBlacklisted(mockToken, mockUserId);

      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
      });
      expect(jwt.decode).toHaveBeenCalledWith(mockToken);
    });

    it("should return true if token was issued before or at the time of last logout", async () => {
      // Arrange
      const lastLogout = new Date(2023, 0, 1, 12, 0, 0); // Jan 1, 2023, 12:00:00
      const tokenIat = Math.floor(lastLogout.getTime() / 1000); // Same time as lastLogout

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: mockUserId,
        lastLogout,
      });
      (jwt.decode as jest.Mock).mockReturnValue({
        userId: mockUserId,
        iat: tokenIat,
      });

      // Act
      const result = await service.isTokenBlacklisted(mockToken, mockUserId);

      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
      });
      expect(jwt.decode).toHaveBeenCalledWith(mockToken);
    });

    it("should return false if token was issued after last logout", async () => {
      // Arrange
      const lastLogout = new Date(2023, 0, 1, 12, 0, 0); // Jan 1, 2023, 12:00:00
      const tokenIat = Math.floor(lastLogout.getTime() / 1000) + 60; // 1 minute after lastLogout

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: mockUserId,
        lastLogout,
      });
      (jwt.decode as jest.Mock).mockReturnValue({
        userId: mockUserId,
        iat: tokenIat,
      });

      // Act
      const result = await service.isTokenBlacklisted(mockToken, mockUserId);

      // Assert
      expect(result).toBe(false);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
      });
      expect(jwt.decode).toHaveBeenCalledWith(mockToken);
    });

    it("should return true if an error occurs during verification", async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockImplementation(() => {
        throw new Error("Database error");
      });

      // Act
      const result = await service.isTokenBlacklisted(mockToken, mockUserId);

      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
      });
    });
  });
});
