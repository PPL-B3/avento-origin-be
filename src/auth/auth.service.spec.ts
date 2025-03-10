import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuthDto } from "./dto";
import * as argon from "argon2";
import { ForbiddenException } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { JwtService } from "./jwt/jwt.service";

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
        {
          provide: JwtService,
          useValue: {
            generateToken: jest.fn().mockReturnValue("mocked-jwt-token"),
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

  describe("logout", () => {
    it("should update lastLogout and return success response", async () => {
      const userId = "123";

      const updateSpy = jest
        .spyOn(prismaService.user, "update")
        .mockResolvedValueOnce({} as any); // bisa juga mock user object jika perlu

      const result = await authService.logout(userId);

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: userId },
        data: { lastLogout: expect.any(BigInt) },
      });

      expect(result).toEqual({
        success: true,
        message: "Berhasil logout",
      });
    });

    it("should throw BadRequestException if userId is missing", async () => {
      await expect(authService.logout("")).rejects.toThrow(
        "User ID harus diisi",
      );
    });

    it("should return failure response if update throws error", async () => {
      const userId = "123";

      jest
        .spyOn(prismaService.user, "update")
        .mockRejectedValueOnce(new Error("DB Error"));

      const result = await authService.logout(userId);

      expect(result).toEqual({
        success: false,
        message: "Gagal logout",
      });
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
      access_token: "mocked-jwt-token",
      user: {
        id: "123",
        email: mockUser.email,
        role: mockUser.role,
      }
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
