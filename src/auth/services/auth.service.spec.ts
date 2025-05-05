import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { AuthDto } from "../dto";
import * as argon from "argon2";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { JwtService } from "../jwt/jwt.service";
import { AuditLogService } from "../../auditLog/auditLog.service";
import { Role, User } from "@prisma/client";
import { PasswordPolicy } from "../interfaces/password-policy.interface";
import { UserRepository } from "../interfaces/user-repository.interface";

describe("AuthService", () => {
  let authService: AuthService;
  let userRepo: UserRepository;
  let auditLogService: AuditLogService;
  let passwordPolicy: PasswordPolicy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: "UserRepository",
          useValue: {
            findById: jest.fn(),
            findByEmail: jest.fn(),
            createUser: jest.fn(),
            markLogout: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            generateToken: jest.fn().mockReturnValue("mocked-jwt-token"),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            addAuditLog: jest.fn(),
          },
        },
        {
          provide: "PasswordPolicy",
          useValue: { validate: jest.fn() },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userRepo = module.get<UserRepository>("UserRepository");
    auditLogService = module.get<AuditLogService>(AuditLogService);
    passwordPolicy = module.get<PasswordPolicy>("PasswordPolicy");
  });

  afterEach(() => jest.clearAllMocks());

  describe("logout", () => {
    it("should update lastLogout, add audit log and return success response", async () => {
      const userId = "123";
      const userEmail = "user@example.com";
      const mockUser = { id: userId, email: userEmail } as User;

      (userRepo.findById as jest.Mock).mockResolvedValue(mockUser);
      (userRepo.markLogout as jest.Mock).mockResolvedValue(undefined);
      const auditSpy = jest
        .spyOn(auditLogService, "addAuditLog")
        .mockResolvedValue({} as any);

      const result = await authService.logout(userId);

      expect(userRepo.findById).toHaveBeenCalledWith(userId);
      expect(userRepo.markLogout).toHaveBeenCalledWith(
        userId,
        expect.any(BigInt),
      );
      expect(auditSpy).toHaveBeenCalledWith({
        eventType: "LOGOUT",
        userID: userId,
        details: `User with email ${userEmail} logged out.`,
      });
      expect(result).toEqual({ success: true, message: "Berhasil logout" });
    });

    it("should throw BadRequestException if userId is missing", async () => {
      await expect(authService.logout("")).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if user is not found", async () => {
      const userId = "nonexistent";
      jest.spyOn(userRepo, "findById").mockResolvedValue(null);
      await expect(authService.logout(userId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(authService.logout(userId)).rejects.toThrow("Gagal Logout");
    });

    it("should return failure response if markLogout throws", async () => {
      const userId = "123";
      (userRepo.findById as jest.Mock).mockResolvedValue({} as User);
      (userRepo.markLogout as jest.Mock).mockRejectedValue(new Error());

      const result = await authService.logout(userId);
      expect(result).toEqual({ success: false, message: "Gagal logout" });
    });

    it("should succeed even if audit log fails", async () => {
      const userId = "123";
      const mockUser = { id: userId, email: "user@example.com" } as User;
      (userRepo.findById as jest.Mock).mockResolvedValue(mockUser);
      (userRepo.markLogout as jest.Mock).mockResolvedValue(undefined);
      (auditLogService.addAuditLog as jest.Mock).mockRejectedValue(
        new Error("audit fail"),
      );
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.logout(userId);

      expect(result).toEqual({ success: true, message: "Berhasil logout" });
      expect(consoleSpy).toHaveBeenCalledWith(
        "Audit log failed:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("register", () => {
    const validDto: AuthDto = {
      email: "test@example.com",
      password: "Password1!",
    };
    const mockUser = {
      id: "123",
      email: validDto.email,
      password: "hashed",
      role: Role.USER,
      lastLogout: BigInt(Date.now()),
      createdAt: new Date(),
    } as User;

    it("should register successfully", async () => {
      (passwordPolicy.validate as jest.Mock).mockImplementation(() => {});
      jest.spyOn(argon, "hash").mockResolvedValue("hashed");
      (userRepo.createUser as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.register(validDto);

      expect(passwordPolicy.validate).toHaveBeenCalledWith(validDto.password);
      expect(argon.hash).toHaveBeenCalledWith(validDto.password);
      expect(userRepo.createUser).toHaveBeenCalledWith({
        email: validDto.email,
        password: "hashed",
        lastLogout: expect.any(BigInt),
      });
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
    });

    it("should throw ForbiddenException on duplicate email", async () => {
      (passwordPolicy.validate as jest.Mock).mockImplementation(() => {});
      jest.spyOn(argon, "hash").mockResolvedValue("hashed");
      (userRepo.createUser as jest.Mock).mockRejectedValue(
        new PrismaClientKnownRequestError("", {
          code: "P2002",
          clientVersion: "",
        }),
      );

      await expect(authService.register(validDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw on unexpected repo error", async () => {
      (passwordPolicy.validate as jest.Mock).mockImplementation(() => {});
      jest.spyOn(argon, "hash").mockResolvedValue("hashed");
      (userRepo.createUser as jest.Mock).mockRejectedValue(
        new Error("Repo failed"),
      );

      await expect(authService.register(validDto)).rejects.toThrow(
        "Repo failed",
      );
    });
  });

  describe("login", () => {
    const dto: AuthDto = { email: "user@example.com", password: "pass123" };
    const mockUser = {
      id: "123",
      email: dto.email,
      password: "hashedpass",
      role: Role.USER,
      lastLogout: BigInt(Date.now()),
      createdAt: new Date(),
    } as User;

    it("should login successfully", async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      jest.spyOn(argon, "verify").mockResolvedValue(true);

      const result = await authService.login(dto);

      expect(userRepo.findByEmail).toHaveBeenCalledWith(dto.email);
      expect(argon.verify).toHaveBeenCalledWith(
        mockUser.password,
        dto.password,
      );
      expect(result).toEqual({
        access_token: "mocked-jwt-token",
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
        },
      });
    });

    it("should throw if user not found", async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(null);
      await expect(authService.login(dto)).rejects.toThrow(ForbiddenException);
    });

    it("should throw if password mismatch", async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      jest.spyOn(argon, "verify").mockResolvedValue(false);
      await expect(authService.login(dto)).rejects.toThrow(ForbiddenException);
    });

    it("should throw on repo error", async () => {
      (userRepo.findByEmail as jest.Mock).mockRejectedValue(
        new Error("DB err"),
      );
      await expect(authService.login(dto)).rejects.toThrow("DB err");
    });
  });
});
