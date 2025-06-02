import { Reflector } from "@nestjs/core";
import { ForbiddenException, ExecutionContext } from "@nestjs/common";
import { RolesGuard } from "./roles.guard";
import { PrismaService } from "../prisma/prisma.service";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let prisma: any;
  const mockCtx = (
    user: any,
    handlerRoles: string[] | undefined,
  ): ExecutionContext =>
    ({
      getHandler: () => {},
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as any);

  beforeEach(() => {
    reflector = new Reflector();
    prisma = {
      user: { findUnique: jest.fn() },
    };
    guard = new RolesGuard(reflector, prisma as PrismaService);
  });

  it("should allow when no roles metadata", async () => {
    jest.spyOn(reflector, "get").mockReturnValue(undefined);
    await expect(
      guard.canActivate(mockCtx({ userId: "1" }, undefined)),
    ).resolves.toBe(true);
  });

  it("should allow when user has required role", async () => {
    jest.spyOn(reflector, "get").mockReturnValue(["ADMIN"]);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "1",
      role: "ADMIN",
    });
    await expect(
      guard.canActivate(mockCtx({ userId: "1" }, ["ADMIN"])),
    ).resolves.toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: "1" } });
  });

  it("should throw if user not found", async () => {
    jest.spyOn(reflector, "get").mockReturnValue(["ADMIN"]);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(
      guard.canActivate(mockCtx({ userId: "1" }, ["ADMIN"])),
    ).rejects.toThrow(ForbiddenException);
  });

  it("should throw if user lacks required role", async () => {
    jest.spyOn(reflector, "get").mockReturnValue(["ADMIN"]);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "1",
      role: "USER",
    });
    await expect(
      guard.canActivate(mockCtx({ userId: "1" }, ["ADMIN"])),
    ).rejects.toThrow(ForbiddenException);
  });
});
