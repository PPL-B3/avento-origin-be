import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "./prisma.service";

describe("PrismaService", () => {
  let service: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await service.$disconnect();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should call $connect() on module init", async () => {
    const connectSpy = jest.spyOn(service, "$connect");
    await service.onModuleInit();
    expect(connectSpy).toHaveBeenCalled();
  });

  it("should call $disconnect() on module destroy", async () => {
    const disconnectSpy = jest.spyOn(service, "$disconnect");
    await service.onModuleDestroy();
    expect(disconnectSpy).toHaveBeenCalled();
  });

  it("should connect to the database", async () => {
    await expect(service.$connect()).resolves.not.toThrow();
  });

  it("should disconnect from the database", async () => {
    await expect(service.$disconnect()).resolves.not.toThrow();
  });
});
