import { AdminSeederService } from "./adminseeder.service";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";

describe("AdminSeederService", () => {
  let service: AdminSeederService;
  let config: Partial<ConfigService>;
  let prisma: any;
  const adminEmail = "admin@test.com";
  const adminPass = "Secret123!";

  beforeEach(() => {
    config = { get: jest.fn() } as any;
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    service = new AdminSeederService(prisma, config as ConfigService);
  });

  it("skips seeding if env vars missing", async () => {
    (config.get as jest.Mock).mockReturnValueOnce(undefined).mockReturnValueOnce(undefined);
    console.warn = jest.fn();
    await service.onModuleInit();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it("does not create if admin already exists", async () => {
    (config.get as jest.Mock).mockReturnValueOnce(adminEmail).mockReturnValueOnce(adminPass);
    prisma.user.findUnique.mockResolvedValue({ id: "1", role: "ADMIN" });
    await service.onModuleInit();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: adminEmail } });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("creates admin if not exists", async () => {
    (config.get as jest.Mock).mockReturnValueOnce(adminEmail).mockReturnValueOnce(adminPass);
    prisma.user.findUnique.mockResolvedValue(null);
    jest.spyOn(argon2, "hash").mockResolvedValue("hashedpass");
    await service.onModuleInit();
    expect(argon2.hash).toHaveBeenCalledWith(adminPass);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: adminEmail,
        password: "hashedpass",
        role: "ADMIN",
        lastLogout: expect.any(BigInt),
      },
    });
  });
});