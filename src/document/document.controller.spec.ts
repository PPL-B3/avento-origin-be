import * as fs from "fs";
import * as path from "path";
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ParseUUIDPipe,
} from "@nestjs/common";
import { DocumentController } from "./document.controller";
import { DocumentService } from "./document.service";
import { Test, TestingModule } from "@nestjs/testing";
import { UploadDocumentDTO } from "./dto/upload-document.dto";
import { QrcodeService } from "../qrcode/qrcode.service";
import { PrismaModule } from "../prisma/prisma.module";

describe("DocumentController", () => {
  let controller: DocumentController;
  let service: DocumentService;
  let mockValidFile: Express.Multer.File;
  let mockOversizedFile: Express.Multer.File;
  let mockBody: UploadDocumentDTO;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [DocumentController],
      providers: [
        {
          provide: DocumentService,
          useValue: {
            uploadDocument: jest.fn().mockResolvedValue({
              message: "Document uploaded successfully.",
              url: "https://mock-url.com/document.pdf",
            }),
            transferDocument: jest.fn(),
            viewDocument: jest.fn(),
          },
        },
        {
          provide: QrcodeService,
          useValue: {
            generateQr: jest.fn().mockResolvedValue({
              privateId: "private123",
              publicId: "public123",
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<DocumentController>(DocumentController);
    service = module.get<DocumentService>(DocumentService);

    // Load the actual PDF file as a Buffer.
    const filePath = path.join(__dirname, "dummy.pdf");
    const fileBuffer = fs.readFileSync(filePath);

    mockValidFile = {
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

    mockOversizedFile = {
      ...mockValidFile,
      size: 12 * 1024 * 1024, // 12MB (exceeds limit).
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
    const invalidFile = { ...mockValidFile, mimetype: "image/png" };
    await expect(
      controller.uploadDocument(invalidFile, mockBody)
    ).rejects.toThrow(new BadRequestException("Invalid file type."));
  });

  it("should throw BadRequestException if file size exceeds 8MB", async () => {
    await expect(
      controller.uploadDocument(mockOversizedFile, mockBody)
    ).rejects.toThrow(new BadRequestException("File size exceeds 8MB limit."));
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
    const response = await controller.uploadDocument(mockValidFile, mockBody);

    expect(response).toEqual({
      privateId: "private123",
      publicId: "public123",
    });

    expect(service.uploadDocument).toHaveBeenCalledWith(
      mockValidFile,
      mockBody
    );
  });

  it("should throw InternalServerErrorException if service throws an error", async () => {
    jest
      .spyOn(service, "uploadDocument")
      .mockRejectedValue(new Error("S3 Upload Failed"));

    await expect(
      controller.uploadDocument(mockValidFile, mockBody)
    ).rejects.toThrow(new InternalServerErrorException("S3 Upload Failed"));
  });

  it("should throw BadRequestException if documentId is missing", async () => {
    await expect(
      controller.transferDocument({
        documentId: "",
        email: "test@example.com",
      }),
    ).rejects.toThrow(new BadRequestException("Missing documentId or email."));
  });

  it("should throw BadRequestException if email is missing", async () => {
    await expect(
      controller.transferDocument({ documentId: "doc-id", email: "" })
    ).rejects.toThrow(new BadRequestException("Missing documentId or email."));
  });

  it("should call transferDocument in the service with correct parameters", async () => {
    jest
      .spyOn(service, "transferDocument")
      .mockResolvedValue({ otp: "000000" });

    const result = await controller.transferDocument({
      documentId: "doc-id",
      email: "test@example.com",
    });

    expect(result).toEqual({ otp: "000000" });
    expect(service.transferDocument).toHaveBeenCalledWith(
      "doc-id",
      "test@example.com"
    );
  });

  it("should propagate errors from the service", async () => {
    jest
      .spyOn(service, "transferDocument")
      .mockRejectedValue(new BadRequestException("Invalid document."));

    await expect(
      controller.transferDocument({
        documentId: "doc-id",
        email: "test@example.com",
      }),
    ).rejects.toThrow(new BadRequestException("Invalid document."));
  });

  it("should return result from service (positive case)", async () => {
    const qrId = "valid-uuid";
    const expectedResult = {
      documentName: "Test Document",
      uploadDate: new Date(),
      publisher: "Test Publisher",
      ownershipHistory: [{ owner: "Owner1", generatedDate: new Date() }],
      currentOwner: "Owner1",
      filePath: "/test/path.pdf",
    };
    jest.spyOn(service, "viewDocument").mockResolvedValue(expectedResult);

    const result = await controller.viewDocument(qrId);
    expect(result).toEqual(expectedResult);
  });

  it("should throw NotFoundException when the service throws one", async () => {
    const qrId = "valid-uuid";
    jest
      .spyOn(service, "viewDocument")
      .mockRejectedValue(new NotFoundException("QR code not found"));
    await expect(controller.viewDocument(qrId)).rejects.toThrow(
      NotFoundException,
    );
  });
});
