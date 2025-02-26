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
    it("should call service.uploadDocument with valid PDF file and valid body", async () => {
      const mockPdf = { mimetype: "application/pdf" } as Express.Multer.File;
      const body = { documentName: "test", ownerName: "user" };
      await controller.uploadDocument(mockPdf, body);
      expect(service.uploadDocument).toHaveBeenCalledWith(mockPdf, body);
    });

    it("should throw error for non-PDF files", async () => {
      const mockText = { mimetype: "text/plain" } as Express.Multer.File;
      await expect(
        controller.uploadDocument(mockText, {
          documentName: "test",
          ownerName: "user",
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw error when no file is uploaded", async () => {
      await expect(
        controller.uploadDocument(null, {
          documentName: "test",
          ownerName: "user",
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw error when required fields are missing", async () => {
      const mockPdf = { mimetype: "application/pdf" } as Express.Multer.File;
      // Test missing documentName
      await expect(
        controller.uploadDocument(mockPdf, {
          documentName: "",
          ownerName: "user",
        })
      ).rejects.toThrow(BadRequestException);
      // Test missing ownerName
      await expect(
        controller.uploadDocument(mockPdf, {
          documentName: "test",
          ownerName: "",
        })
      ).rejects.toThrow(BadRequestException);
    });
  });
});
