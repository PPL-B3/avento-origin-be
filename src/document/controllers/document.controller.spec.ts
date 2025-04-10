import * as fs from "fs";
import * as path from "path";
import {
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DocumentController } from "./document.controller";
import { DocumentService } from "../services/document.service";
import { UploadDocumentDTO } from "../dto/upload-document.dto";
import { TransferDocumentDTO } from "../dto/transfer-document.dto";
import { ClaimDocumentDTO } from "../dto/claim-document.dto";

describe("DocumentController", () => {
  let controller: DocumentController;
  let docService: Partial<DocumentService>;
  let mockValidFile: Express.Multer.File;
  let mockOversizedFile: Express.Multer.File;
  let uploadDto: UploadDocumentDTO;
  let transferDto: TransferDocumentDTO;
  let claimDto: ClaimDocumentDTO;

  beforeEach(async () => {
    // Create a dummy PDF buffer from the file on disk
    const filePath = path.join(__dirname, "../dummy.pdf");
    const fileBuffer = fs.existsSync(filePath)
      ? fs.readFileSync(filePath)
      : Buffer.from("PDFdata");

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

    mockOversizedFile = { ...mockValidFile, size: 12 * 1024 * 1024 };

    uploadDto = {
      documentName: "Test Document",
      ownerName: "test@example.com",
    };

    transferDto = {
      documentId: "doc-id",
      pendingOwner: "newowner@example.com",
    };

    claimDto = {
      documentId: "doc-id",
      otp: "123456",
    };

    docService = {
      uploadDocument: jest.fn().mockResolvedValue({
        message: "Uploaded",
        url: "http://example.com/doc.pdf",
      }),
      transferDocument: jest.fn().mockResolvedValue({ otp: "654321" }),
      claimDocument: jest
        .fn()
        .mockResolvedValue({ privateId: "private123", publicId: "public123" }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentController],
      providers: [{ provide: DocumentService, useValue: docService }],
    }).compile();

    controller = module.get<DocumentController>(DocumentController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("uploadDocument", () => {
    it("should throw BadRequestException if no file is uploaded", async () => {
      await expect(controller.uploadDocument(null!, uploadDto)).rejects.toThrow(
        new BadRequestException("No file uploaded.")
      );
    });

    it("should throw BadRequestException for invalid file type", async () => {
      const invalidFile = { ...mockValidFile, mimetype: "image/png" };
      await expect(
        controller.uploadDocument(invalidFile, uploadDto)
      ).rejects.toThrow(new BadRequestException("Invalid file type."));
    });

    it("should throw BadRequestException for oversized file", async () => {
      await expect(
        controller.uploadDocument(mockOversizedFile, uploadDto)
      ).rejects.toThrow(
        new BadRequestException("File size exceeds 8MB limit.")
      );
    });

    it("should return result from service on valid input", async () => {
      const result = await controller.uploadDocument(mockValidFile, uploadDto);
      expect(result).toEqual({
        message: "Uploaded",
        url: "http://example.com/doc.pdf",
      });
      expect(docService.uploadDocument).toHaveBeenCalledWith(
        mockValidFile,
        uploadDto
      );
    });

    it("should propagate errors from service", async () => {
      (docService.uploadDocument as jest.Mock).mockRejectedValueOnce(
        new InternalServerErrorException("S3 Error")
      );
      await expect(
        controller.uploadDocument(mockValidFile, uploadDto)
      ).rejects.toThrow(new InternalServerErrorException("S3 Error"));
    });
  });

  describe("transferDocument", () => {
    it("should call service.transferDocument and return its result", async () => {
      const result = await controller.transferDocument(transferDto);
      expect(result).toEqual({ otp: "654321" });
      expect(docService.transferDocument).toHaveBeenCalledWith(
        transferDto.documentId,
        transferDto.pendingOwner
      );
    });
  });

  describe("claimDocument", () => {
    it("should call service.claimDocument and return its result", async () => {
      const result = await controller.claimDocument(claimDto);
      expect(result).toEqual({
        privateId: "private123",
        publicId: "public123",
      });
      expect(docService.claimDocument).toHaveBeenCalledWith(
        claimDto.documentId,
        claimDto.otp
      );
    });
  });
});
