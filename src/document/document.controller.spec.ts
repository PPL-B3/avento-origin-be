import { Test, TestingModule } from "@nestjs/testing";
import { DocumentController } from "./document.controller";
import { DocumentService } from "./document.service";
import {
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { UploadDocumentDTO } from "./dto/upload-document.dto";
import * as fs from "fs";
import * as path from "path";

describe("DocumentController", () => {
  let controller: DocumentController;
  let service: DocumentService;
  let mockFile: Express.Multer.File;
  let mockBody: UploadDocumentDTO;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentController],
      providers: [
        {
          provide: DocumentService,
          useValue: {
            uploadDocument: jest.fn().mockResolvedValue({
              message: "Document uploaded successfully.",
              url: "https://mock-url.com/document.pdf",
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<DocumentController>(DocumentController);
    service = module.get<DocumentService>(DocumentService);

    // Load the actual PDF file as a Buffer
    const filePath = path.join(__dirname, "dummy.pdf");
    const fileBuffer = fs.readFileSync(filePath);

    mockFile = {
      buffer: fileBuffer,
      mimetype: "application/pdf",
      originalname: "dummy.pdf",
      fieldname: "file",
      encoding: "7bit",
      size: fileBuffer.length,
      destination: "",
      filename: "dummy.pdf",
      path: filePath,
    } as Express.Multer.File;

    mockBody = {
      documentName: "Test Document",
      ownerName: "John Doe",
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should throw BadRequestException if no file is uploaded", async () => {
    await expect(controller.uploadDocument(null, mockBody)).rejects.toThrow(
      new BadRequestException("No file uploaded.")
    );
  });

  it("should throw BadRequestException if file type is not PDF", async () => {
    const invalidFile = { ...mockFile, mimetype: "image/png" };
    await expect(
      controller.uploadDocument(invalidFile, mockBody)
    ).rejects.toThrow(new BadRequestException("Invalid file type."));
  });

  it("should throw error when required fields are missing", async () => {
    const mockPdf = { mimetype: "application/pdf" } as Express.Multer.File;
    // Test missing documentName.
    await expect(
      controller.uploadDocument(mockPdf, {
        documentName: "",
        ownerName: "user",
      })
    ).rejects.toThrow(BadRequestException);
    // Test missing ownerName.
    await expect(
      controller.uploadDocument(mockPdf, {
        documentName: "test",
        ownerName: "",
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("should return success response if file and body are valid", async () => {
    const response = await controller.uploadDocument(mockFile, mockBody);

    expect(response).toEqual({
      message: "Document uploaded successfully.",
      url: "https://mock-url.com/document.pdf",
    });

    expect(service.uploadDocument).toHaveBeenCalledWith(mockFile, mockBody);
  });

  it("should throw InternalServerErrorException if service throws an error", async () => {
    jest
      .spyOn(service, "uploadDocument")
      .mockRejectedValue(new Error("S3 Upload Failed"));

    await expect(controller.uploadDocument(mockFile, mockBody)).rejects.toThrow(
      new InternalServerErrorException("S3 Upload Failed")
    );
  });
});
