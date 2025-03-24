import { ConfigModule } from "@nestjs/config";
import { DocumentController } from "./document.controller";
import { DocumentService } from "./document.service";
import { Test, TestingModule } from "@nestjs/testing";
import { QrcodeModule } from "../qrcode/qrcode.module";
import { PrismaModule } from "../prisma/prisma.module";

describe("DocumentModule", () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        PrismaModule,
        ConfigModule.forRoot({ isGlobal: true }),
        QrcodeModule,
      ],
      providers: [DocumentService],
      controllers: [DocumentController],
    }).compile();
  });

  it("should compile the module", () => {
    expect(module).toBeDefined();
  });

  it("should provide DocumentService", () => {
    const service = module.get<DocumentService>(DocumentService);
    expect(service).toBeInstanceOf(DocumentService);
  });

  it("should have DocumentController", () => {
    const controller = module.get<DocumentController>(DocumentController);
    expect(controller).toBeDefined();
  });
});
