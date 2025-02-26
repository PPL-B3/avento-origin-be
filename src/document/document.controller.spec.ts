import { Test, TestingModule } from "@nestjs/testing";
import { DocumentController } from "./document.controller";
import { DocumentService } from "./document.service";
import { BadRequestException } from "@nestjs/common";

describe("DocumentController", () => {
  let controller: DocumentController;
  let service: DocumentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentController],
      providers: [
        {
          provide: DocumentService,
          useValue: {
            uploadDocument: jest.fn().mockResolvedValue({
              message: "Document uploaded successfully",
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<DocumentController>(DocumentController);
    service = module.get<DocumentService>(DocumentService);
  });

  describe("uploadDocument", () => {
    it("should validate PDF files", async () => {
      const mockPdf = { mimetype: "application/pdf" } as Express.Multer.File;
      await controller.uploadDocument(mockPdf, {
        documentName: "test",
        ownerName: "user",
      });
      expect(service.uploadDocument).toHaveBeenCalled();
    });

    it("should reject non-PDF files", async () => {
      const mockText = { mimetype: "text/plain" } as Express.Multer.File;
      await expect(
        controller.uploadDocument(mockText, {
          documentName: "test",
          ownerName: "user",
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("should require document name and owner", async () => {
      await expect(controller.uploadDocument(null, {} as any)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
