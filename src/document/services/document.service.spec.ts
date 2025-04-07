import { DocumentService } from "./document.service";
import { S3StorageService } from "./s3-storage.service";
import { DocumentRepository } from "../repositories/document.repository";
import { EmailService } from "./email.service";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { BadRequestException } from "@nestjs/common";

describe("DocumentService", () => {
  let service: DocumentService;
  let s3Storage: jest.Mocked<S3StorageService>;
  let repo: jest.Mocked<DocumentRepository>;
  let email: jest.Mocked<EmailService>;
  let config: jest.Mocked<ConfigService>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    s3Storage = { uploadPDF: jest.fn() } as any;
    repo = {
      createDocument: jest.fn(),
      findDocumentById: jest.fn(),
      updateDocument: jest.fn(),
      changeOwnership: jest.fn(),
    } as any;
    email = { sendOwnershipTransferEmail: jest.fn() } as any;
    config = { get: jest.fn() } as any;
    // For simplicity, let $transaction just call the passed callback with a dummy transaction (here, using prisma as the transaction client)
    prisma = {
      $transaction: jest.fn().mockImplementation((fn) => fn(prisma)),
    } as any;

    service = new DocumentService(s3Storage, repo, email, config, prisma);
  });

  describe("uploadDocument", () => {
    it("uploads file and creates document", async () => {
      config.get.mockReturnValue("bucket-name");
      s3Storage.uploadPDF.mockResolvedValue("http://example.com/file.pdf");
      repo.createDocument.mockResolvedValue({
        privateId: "new-qr-private",
        publicId: "new-qr-public",
      });

      const file = {
        buffer: Buffer.from("pdf"),
        mimetype: "application/pdf",
      } as any;
      const dto = { documentName: "My Doc", ownerName: "Alice" };

      const result = await service.uploadDocument(file, dto);
      expect(s3Storage.uploadPDF).toHaveBeenCalledWith(
        file.buffer,
        file.mimetype,
        "bucket-name",
        expect.stringMatching(/^Alice_My-Doc_\d+\.pdf$/)
      );
      expect(repo.createDocument).toHaveBeenCalled();
      expect(result).toEqual({ id: "doc-id" });
    });

    it("throws if bucket is not configured", async () => {
      config.get.mockReturnValue(undefined);
      await expect(
        service.uploadDocument({} as any, { documentName: "x", ownerName: "y" })
      ).rejects.toThrow("DO_SPACES_BUCKET is not configured");
    });
  });

  describe("transferDocument", () => {
    it("sends transfer email and updates document with OTP", async () => {
      // Provide a minimal document with all required fields
      repo.findDocumentById.mockResolvedValue({
        documentID: "doc-id",
        documentName: "My Doc",
        filePath: "url",
        uploadDate: new Date(),
        publisher: "Alice",
        pendingOwner: null,
        otp: null,
        otpExpiry: null,
        otpAttemptCount: 0,
        qrCode: [
          {
            id: "qr1",
            owner: "currentOwner",
            isPrivate: false,
            isActive: true,
            generatedDate: new Date(),
            documentId: "doc-id",
          },
          {
            id: "qr2",
            owner: "x",
            isPrivate: true,
            isActive: true,
            generatedDate: new Date(),
            documentId: "doc-id",
          },
        ],
      });
      repo.updateDocument.mockResolvedValue({} as any);

      const result = await service.transferDocument(
        "doc-id",
        "newowner@example.com"
      );
      expect(result.otp).toHaveLength(6);
      expect(repo.updateDocument).toHaveBeenCalledWith(
        "doc-id",
        expect.objectContaining({
          pendingOwner: "newowner@example.com",
          otp: expect.any(String),
          otpExpiry: expect.any(Date),
          otpAttemptCount: 0,
        })
      );
      expect(email.sendOwnershipTransferEmail).toHaveBeenCalledWith(
        "newowner@example.com",
        "My Doc",
        "currentOwner",
        "Alice",
        "doc-id"
      );
    });
  });

  describe("claimDocument", () => {
    const baseDoc = {
      documentID: "doc-id",
      documentName: "My Doc",
      filePath: "url",
      uploadDate: new Date(),
      publisher: "Alice",
      pendingOwner: "newowner@example.com",
      otp: "123456",
      otpExpiry: new Date(Date.now() + 5 * 60 * 1000),
      otpAttemptCount: 0,
      qrCode: [
        {
          id: "qr1",
          owner: "currentOwner",
          isPrivate: false,
          isActive: true,
          generatedDate: new Date(),
          documentId: "doc-id",
        },
        {
          id: "qr2",
          owner: "x",
          isPrivate: true,
          isActive: true,
          generatedDate: new Date(),
          documentId: "doc-id",
        },
      ],
    };

    it("claims document successfully with correct OTP", async () => {
      repo.findDocumentById.mockResolvedValue(baseDoc);
      // changeOwnership should return an object with privateId and publicId
      repo.changeOwnership.mockResolvedValue({
        privateId: "new-qr-private",
        publicId: "new-qr-public",
      });
      // updateDocument is used to clear transfer data – we cast the update payload to any to bypass TS error.
      repo.updateDocument.mockResolvedValue({} as any);

      const result = await service.claimDocument("doc-id", "123456");
      expect(repo.findDocumentById).toHaveBeenCalledWith("doc-id", prisma);
      expect(repo.changeOwnership).toHaveBeenCalled();
      expect(repo.updateDocument).toHaveBeenCalledWith(
        "doc-id",
        {
          pendingOwner: null,
          otp: null,
          otpExpiry: null,
          otpAttemptCount: 0,
        } as any,
        prisma
      );
      expect(result).toEqual({
        privateId: "new-qr-private",
        publicId: "new-qr-public",
      });
    });

    it("throws if no pending owner", async () => {
      repo.findDocumentById.mockResolvedValue({
        ...baseDoc,
        pendingOwner: null,
      });
      await expect(service.claimDocument("doc-id", "123456")).rejects.toThrow(
        "No pending transfer."
      );
    });

    it("throws if OTP expired", async () => {
      repo.findDocumentById.mockResolvedValue({
        ...baseDoc,
        otpExpiry: new Date(Date.now() - 1000),
      });
      await expect(service.claimDocument("doc-id", "123456")).rejects.toThrow(
        "OTP expired."
      );
    });

    it("throws if too many failed attempts", async () => {
      repo.findDocumentById.mockResolvedValue({
        ...baseDoc,
        otpAttemptCount: 4,
      });
      await expect(service.claimDocument("doc-id", "123456")).rejects.toThrow(
        "Too many failed attempts."
      );
    });

    it("handles incorrect OTP by incrementing attempts and throwing", async () => {
      repo.findDocumentById.mockResolvedValue({ ...baseDoc, otp: "999999" });
      repo.updateDocument.mockResolvedValue({} as any);
      await expect(service.claimDocument("doc-id", "000000")).rejects.toThrow(
        "Incorrect OTP."
      );
      expect(repo.updateDocument).toHaveBeenCalledWith("doc-id", {
        otpAttemptCount: { increment: 1 },
      } as any);
    });
  });

  describe("private helpers", () => {
    it("getCurrentOwner returns the public QR owner", () => {
      const doc = {
        qrCode: [
          { isPrivate: true, owner: "private" },
          { isPrivate: false, owner: "public" },
        ],
      };
      const result = (service as any).getCurrentOwner(doc);
      expect(result).toBe("public");
    });

    it("generateFilename sanitizes names and formats correctly", () => {
      const dto = { ownerName: "John Doe", documentName: "My Doc" };
      const result = (service as any).generateFilename(dto, 123456);
      expect(result).toBe("John-Doe_My-Doc_123456.pdf");
    });
  });
});
