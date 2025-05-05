// prisma-user.repository.spec.ts

import { Test, TestingModule } from "@nestjs/testing";
import { PrismaUserRepository } from "./prisma-user.repository";
import { PrismaService } from "../../prisma/prisma.service";
import { User, Role } from "@prisma/client";

describe("PrismaUserRepository", () => {
  let repo: PrismaUserRepository;
  let prismaMock: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  // A fixed date to keep tests deterministic
  const FIXED_DATE = new Date("2025-05-05T12:00:00.000Z");

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaUserRepository,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    repo = module.get<PrismaUserRepository>(PrismaUserRepository);
  });

  describe("findById", () => {
    it("should return a User when found", async () => {
      const fakeUser: User = {
        id: "abc",
        email: "foo@bar.com",
        password: "hashed",
        lastLogout: BigInt(123),
        createdAt: FIXED_DATE,
        role: Role.USER,
      };
      prismaMock.user.findUnique.mockResolvedValue(fakeUser);

      const result = await repo.findById("abc");

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: "abc" },
      });
      expect(result).toEqual(fakeUser);
    });

    it("should return null when no user exists", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await repo.findById("does-not-exist");

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: "does-not-exist" },
      });
      expect(result).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("should return a User when found", async () => {
      const fakeUser: User = {
        id: "xyz",
        email: "hello@world.com",
        password: "secret",
        lastLogout: BigInt(0),
        createdAt: FIXED_DATE,
        role: Role.USER,
      };
      prismaMock.user.findUnique.mockResolvedValue(fakeUser);

      const result = await repo.findByEmail("hello@world.com");

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: "hello@world.com" },
      });
      expect(result).toEqual(fakeUser);
    });

    it("should return null when no user with that email", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await repo.findByEmail("missing@user.com");

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: "missing@user.com" },
      });
      expect(result).toBeNull();
    });
  });

  describe("createUser", () => {
    it("should create and return the new user", async () => {
      const input = {
        email: "new@user.com",
        password: "pw",
        lastLogout: BigInt(0),
      };
      const created: User = {
        id: "newid",
        ...input,
        createdAt: FIXED_DATE,
        role: Role.USER,
      };
      prismaMock.user.create.mockResolvedValue(created);

      const result = await repo.createUser(input);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: input,
      });
      expect(result).toEqual(created);
    });
  });

  describe("markLogout", () => {
    it("should update the lastLogout timestamp", async () => {
      prismaMock.user.update.mockResolvedValue({} as any);

      await repo.markLogout("abc", BigInt(999));

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "abc" },
        data: { lastLogout: BigInt(999) },
      });
    });
  });
});
