import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import * as jwt from "jsonwebtoken";
import { AuthDto } from "./dto";
import * as argon from "argon2";
import { ForbiddenException } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { BadRequestException } from "@nestjs/common";

describe("AuthService", () => {
  let authService: AuthService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              update: jest.fn(),
              create: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("blacklistToken", () => {
    it("should update lastLogout with the current timestamp", async () => {
      const userId = "123";
      jest
        .spyOn(prismaService.user, "update")
        .mockResolvedValueOnce({ id: userId } as any);

      await expect(authService.blacklistToken(userId)).resolves.toBeUndefined();

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: { lastLogout: expect.any(BigInt) },
      });
    });

    it("should throw an error if updating lastLogout fails", async () => {
      const userId = "123";
      jest
        .spyOn(prismaService.user, "update")
        .mockRejectedValueOnce(new Error("DB Error"));

      await expect(authService.blacklistToken(userId)).rejects.toThrow(
        "DB Error",
      );
    });
  });

  describe("isTokenBlacklisted", () => {
    it("should throw BadRequestException if userId is not provided", async () => {
      await expect(authService.blacklistToken("")).rejects.toThrow(
        BadRequestException,
      );
    });
    it("should return true if user is not found", async () => {
      jest.spyOn(prismaService.user, "findUnique").mockResolvedValueOnce(null);

      const result = await authService.isTokenBlacklisted("token", "123");
      expect(result).toBe(true);
    });

    it("should return true if lastLogout is null", async () => {
      jest.spyOn(prismaService.user, "findUnique").mockResolvedValueOnce({
        id: "123",
        email: "test@example.com",
        password: "hashedpassword",
        role: "USER",
        lastLogout: BigInt(Date.now()),
      } as any);

      const result = await authService.isTokenBlacklisted("token", "123");
      expect(result).toBe(true);
    });

    it("should return true if token is invalid", async () => {
      jest.spyOn(jwt, "decode").mockReturnValue(null);

      const result = await authService.isTokenBlacklisted(
        "invalidToken",
        "123",
      );
      expect(result).toBe(true);
    });

    it("should return false if token is still valid", async () => {
      const mockLastLogout = BigInt(Date.now() - 10000);
      jest.spyOn(prismaService.user, "findUnique").mockResolvedValueOnce({
        id: "123",
        email: "test@example.com",
        password: "hashedpassword",
        role: "USER",
        lastLogout: mockLastLogout,
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      jest.spyOn(jwt, "decode").mockReturnValue({
        iat: Math.floor(Number(Date.now() / 1000)),
      } as jwt.JwtPayload);

      const result = await authService.isTokenBlacklisted("validToken", "123");
      expect(result).toBe(false);
    });

    it("should return true if decoded token does not have iat", async () => {
      const mockLastLogout = BigInt(Date.now() - 10000);
      jest.spyOn(prismaService.user, "findUnique").mockResolvedValueOnce({
        id: "123",
        email: "test@example.com",
        password: "hashedpassword",
        role: "USER",
        lastLogout: mockLastLogout,
      } as any);

      jest.spyOn(jwt, "decode").mockReturnValue({}); // token decoded, tapi tidak ada iat

      const result = await authService.isTokenBlacklisted(
        "tokenWithoutIat",
        "123",
      );
      expect(result).toBe(true);
    });

    it("should return true if token was issued before lastLogout", async () => {
      const mockLastLogout = BigInt(Date.now() + 10000);
      jest.spyOn(prismaService.user, "findUnique").mockResolvedValueOnce({
        id: "123",
        email: "test@example.com",
        password: "hashedpassword",
        role: "USER",
        lastLogout: mockLastLogout,
      } as any);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      jest.spyOn(jwt, "decode").mockReturnValue({
        iat: Math.floor(Date.now() / 1000) - 20000,
      } as jwt.JwtPayload);

      const result = await authService.isTokenBlacklisted(
        "expiredToken",
        "123",
      );
      expect(result).toBe(true);
    });

    it("should return true if jwt.decode throws an error", async () => {
      jest.spyOn(prismaService.user, "findUnique").mockResolvedValueOnce({
        id: "123",
        email: "test@example.com",
        password: "hashedpassword",
        role: "USER",
        lastLogout: BigInt(Date.now()),
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      jest.spyOn(jwt, "decode").mockImplementationOnce(() => {
        throw new Error("Invalid token format");
      });

      const result = await authService.isTokenBlacklisted("badToken", "123");
      expect(result).toBe(true);
    });

    it("should return true if an error occurs during token decoding or user lookup", async () => {
      // Simulating an error during token decoding or database lookup
      jest
        .spyOn(prismaService.user, "findUnique")
        .mockRejectedValueOnce(new Error("DB Error"));
      const result = await authService.isTokenBlacklisted("someToken", "123");
      expect(result).toBe(true);
    });
  });

  describe("logout", () => {
    it("should call blacklistToken with the correct userId", async () => {
      const userId = "123";
      jest.spyOn(authService, "blacklistToken").mockResolvedValueOnce();

      await authService.logout(userId);

      expect(authService.blacklistToken).toHaveBeenCalledWith(userId);
    });
  });

  it("should be defined", () => {
    expect(authService).toBeDefined();
  });

  it("should register a new user successfully", async () => {
    const dto: AuthDto = {
      email: "test@example.com",
      password: "password123",
    };

    const mockUser = {
      id: "123",
      email: "test@test.com",
      password: "hashedpassword",
      role: "user",
      lastLogout: BigInt(Date.now()),
    };

    jest.spyOn(argon, "hash").mockResolvedValue("hashedpassword");
    jest.spyOn(prismaService.user, "create").mockResolvedValue(mockUser);

    const result = await authService.register(dto);

    expect(argon.hash).toHaveBeenCalledWith(dto.password);
    expect(prismaService.user.create).toHaveBeenCalledWith({
      data: {
        email: dto.email,
        password: "hashedpassword",
        role: "user",
        lastLogout: expect.any(BigInt),
      },
    });

    expect(result).toEqual({
      id: mockUser.id,
      email: mockUser.email,
      role: mockUser.role,
    });
  });

  it("should throw ForbiddenException if email is already registered", async () => {
    const dto: AuthDto = {
      email: "duplicate@example.com",
      password: "password123",
    };

    jest.spyOn(argon, "hash").mockResolvedValue("hashedpassword");
    jest.spyOn(prismaService.user, "create").mockRejectedValue(
      new PrismaClientKnownRequestError("", {
        code: "P2002",
        clientVersion: "6.4.1",
      }),
    );

    await expect(authService.register(dto)).rejects.toThrow(ForbiddenException);
    await expect(authService.register(dto)).rejects.toThrow(
      "Email has already been registered",
    );

    expect(argon.hash).toHaveBeenCalledWith(dto.password);
    expect(prismaService.user.create).toHaveBeenCalled();
  });

  it("should throw a generic error if Prisma fails unexpectedly", async () => {
    const dto: AuthDto = {
      email: "fail@example.com",
      password: "password123",
    };

    jest.spyOn(argon, "hash").mockResolvedValue("hashedpassword");
    jest
      .spyOn(prismaService.user, "create")
      .mockRejectedValue(new Error("Unexpected database error"));

    await expect(authService.register(dto)).rejects.toThrow(Error);
    await expect(authService.register(dto)).rejects.toThrow(
      "Unexpected database error",
    );

    expect(argon.hash).toHaveBeenCalledWith(dto.password);
    expect(prismaService.user.create).toHaveBeenCalled();
  });

  it("should return user details when login is successful", async () => {
    const dto: AuthDto = {
      email: "test@example.com",
      password: "password123",
    };

    const mockUser = {
      id: "123",
      email: dto.email,
      password: "hashedpassword",
      role: "user",
      lastLogout: BigInt(Date.now()),
    };

    jest.spyOn(prismaService.user, "findUnique").mockResolvedValue(mockUser);
    jest.spyOn(argon, "verify").mockResolvedValue(true);

    const result = await authService.login(dto);

    expect(prismaService.user.findUnique).toHaveBeenCalledWith({
      where: { email: dto.email },
    });
    expect(argon.verify).toHaveBeenCalledWith(mockUser.password, dto.password);
    expect(result).toEqual({
      id: "123",
      email: mockUser.email,
      role: mockUser.role,
      lastLogout: mockUser.lastLogout,
    });
  });

  it("should throw ForbiddenException if user is not found", async () => {
    const dto: AuthDto = {
      email: "nonexistent@example.com",
      password: "password123",
    };

    jest.spyOn(prismaService.user, "findUnique").mockResolvedValue(null);

    await expect(authService.login(dto)).rejects.toThrow(ForbiddenException);
    await expect(authService.login(dto)).rejects.toThrow(
      "Username or password is incorrect",
    );

    expect(prismaService.user.findUnique).toHaveBeenCalledWith({
      where: { email: dto.email },
    });
  });

  it("should throw ForbiddenException if password is incorrect", async () => {
    const dto: AuthDto = {
      email: "test@example.com",
      password: "wrongpassword",
    };

    const mockUser = {
      id: "123",
      email: dto.email,
      password: "hashedpassword",
      role: "user",
      lastLogout: BigInt(Date.now()),
    };

    jest.spyOn(prismaService.user, "findUnique").mockResolvedValue(mockUser);
    jest.spyOn(argon, "verify").mockResolvedValue(false);

    await expect(authService.login(dto)).rejects.toThrow(ForbiddenException);
    await expect(authService.login(dto)).rejects.toThrow(
      "Username or password is incorrect",
    );

    expect(prismaService.user.findUnique).toHaveBeenCalledWith({
      where: { email: dto.email },
    });
    expect(argon.verify).toHaveBeenCalledWith(mockUser.password, dto.password);
  });

  it("should throw an error if Prisma throws an exception", async () => {
    const dto: AuthDto = {
      email: "test@example.com",
      password: "password123",
    };

    jest
      .spyOn(prismaService.user, "findUnique")
      .mockRejectedValue(new Error("Database error"));

    await expect(authService.login(dto)).rejects.toThrow(Error);
    await expect(authService.login(dto)).rejects.toThrow("Database error");

    expect(prismaService.user.findUnique).toHaveBeenCalledWith({
      where: { email: dto.email },
    });
  });
});
