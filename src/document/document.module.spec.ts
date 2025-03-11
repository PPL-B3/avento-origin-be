import { DocumentController } from "./document.controller";
import { DocumentModule } from "./document.module";
import { DocumentService } from "./document.service";
import { Test, TestingModule } from "@nestjs/testing";

describe("DocumentModule", () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DocumentModule],
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
