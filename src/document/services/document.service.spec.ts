import { DocumentService } from "./document.service";
import { S3StorageService } from "./s3-storage.service";
import { DocumentRepository } from "../repositories/document.repository";
import { EmailService } from "./email.service";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "../../auditLog/auditLog.service";

describe("DocumentService", () => {
  let service: DocumentService;
  let s3Storage: jest.Mocked<S3StorageService>;
  let repo: jest.Mocked<DocumentRepository>;
  let email: jest.Mocked<EmailService>;
  let config: jest.Mocked<ConfigService>;
  let prisma: jest.Mocked<PrismaService>;
  let auditLog: jest.Mocked<AuditLogService>;

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
    const posthog = { captureEvent: jest.fn() } as any;
    prisma = {
      $transaction: jest.fn().mockImplementation((fn) => fn(prisma)),
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      qrCode: {
        findUnique: jest.fn(),
      },
    } as any;
    auditLog = {
      addAuditLog: jest.fn(),
    } as any;

    service = new DocumentService(
      s3Storage,
      repo,
      email,
      config,
      posthog,
      prisma,
      auditLog,
    );
  });

  describe("uploadDocument", () => {
    it("uploads file and creates document", async () => {
      config.get.mockReturnValue("bucket-name");
      s3Storage.uploadPDF.mockResolvedValue("http://example.com/file.pdf");
      repo.createDocument.mockResolvedValue({
        privateId: "new-qr-private",
        publicId: "new-qr-public",
        documentId: "new-document-id",
      });

      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: "user-id-123",
        email: "alice@example.com",
      });

      const file = {
        buffer: Buffer.from("pdf"),
        mimetype: "application/pdf",
      } as any;
      const dto = { documentName: "My Doc" };

      const result = await service.uploadDocument(file, dto, "user-id-123");
      expect(s3Storage.uploadPDF).toHaveBeenCalledWith(
        file.buffer,
        file.mimetype,
        "bucket-name",
        expect.stringMatching(/^alice@example\.com_My-Doc_\d+\.pdf$/),
      );
      expect(repo.createDocument).toHaveBeenCalled();
      expect(result).toEqual({
        privateId: "new-qr-private",
        publicId: "new-qr-public",
      });
    });

    it("throws if bucket is not configured", async () => {
      config.get.mockReturnValue(undefined);
      await expect(
        service.uploadDocument(
          {} as any,
          {
            documentName: "x",
          },
          "user-id-123",
        ),
      ).rejects.toThrow("DO_SPACES_BUCKET is not configured");
    });

    it("adds audit log if user exists", async () => {
      config.get.mockReturnValue("bucket-name");
      s3Storage.uploadPDF.mockResolvedValue("http://example.com/file.pdf");
      repo.createDocument.mockResolvedValue({
        privateId: "new-qr-private",
        publicId: "new-qr-public",
        documentId: "new-document-id",
      });
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: "user-id-123",
        email: "alice@example.com",
      });

      const file = {
        buffer: Buffer.from("pdf"),
        mimetype: "application/pdf",
      } as any;
      const dto = { documentName: "Audit Doc" };

      await service.uploadDocument(file, dto, "user-id-123");

      expect(auditLog.addAuditLog).toHaveBeenCalledWith({
        eventType: "UPLOAD_DOCUMENT",
        userID: "user-id-123",
        details: 'Document "Audit Doc" uploaded.',
        documentID: "new-document-id",
      });
    });

    it("does not add audit log if user is not found", async () => {
      config.get.mockReturnValue("bucket-name");
      s3Storage.uploadPDF.mockResolvedValue("http://example.com/file.pdf");
      repo.createDocument.mockResolvedValue({
        privateId: "new-qr-private",
        publicId: "new-qr-public",
        documentId: "new-document-id",
      });
      (prisma.user.findUniqueOrThrow as jest.Mock).mockRejectedValue(new Error("Not Found"));

      const file = {
        buffer: Buffer.from("pdf"),
        mimetype: "application/pdf",
      } as any;
      const dto = { documentName: "No Audit" };
      await expect(
        service.uploadDocument(file, dto, "ghost-user"),
      ).rejects.toThrow();
      expect(auditLog.addAuditLog).not.toHaveBeenCalled();
    });
  });

  describe("transferDocument", () => {
    it("sends transfer email and updates document with OTP", async () => {
      // Mock return dari findDocumentById
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

      // Mock updateDocument
      repo.updateDocument.mockResolvedValue({} as any);

      // Cast prisma.user.findUnique sebagai mock dan mock hasilnya
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user-id-123",
      });

      const result = await service.transferDocument(
        "doc-id",
        "newowner@example.com",
      );

      expect(result.otp).toHaveLength(6);
      expect(repo.updateDocument).toHaveBeenCalledWith(
        "doc-id",
        expect.objectContaining({
          pendingOwner: "newowner@example.com",
          otp: expect.any(String),
          otpExpiry: expect.any(Date),
          otpAttemptCount: 0,
        }),
      );

      expect(email.sendOwnershipTransferEmail).toHaveBeenCalledWith(
        "newowner@example.com",
        "My Doc",
        "currentOwner",
        "Alice",
        "doc-id",
      );

      expect(auditLog.addAuditLog).toHaveBeenCalledWith({
        eventType: "TRANSFER_OWNERSHIP",
        userID: "user-id-123",
        details:
          'Ownership transfer initiated for document "My Doc" to newowner@example.com',
        documentID: "doc-id",
      });
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
        documentId: "new-document-id",
      });
      // updateDocument is used to clear transfer data – we cast the update payload to any to bypass TS error.
      repo.updateDocument.mockResolvedValue({} as any);

      const result = await service.claimDocument("doc-id", "123456");
      expect(repo.findDocumentById).toHaveBeenCalledWith("doc-id");
      expect(repo.changeOwnership).toHaveBeenCalled();
      expect(repo.updateDocument).toHaveBeenCalledWith(
        "doc-id",
        {
          pendingOwner: null,
          otp: null,
          otpExpiry: null,
          otpAttemptCount: 0,
        } as any,
        prisma,
      );
      expect(result).toEqual({
        documentId: "new-document-id",
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
        "No pending transfer.",
      );
    });

    it("throws if OTP expired", async () => {
      repo.findDocumentById.mockResolvedValue({
        ...baseDoc,
        otpExpiry: new Date(Date.now() - 1000),
      });
      await expect(service.claimDocument("doc-id", "123456")).rejects.toThrow(
        "OTP expired.",
      );
    });

    it("throws if too many failed attempts", async () => {
      repo.findDocumentById.mockResolvedValue({
        ...baseDoc,
        otpAttemptCount: 4,
      });
      await expect(service.claimDocument("doc-id", "123456")).rejects.toThrow(
        "Too many failed attempts.",
      );
    });

    it("handles incorrect OTP by incrementing attempts and throwing", async () => {
      repo.findDocumentById.mockResolvedValue({ ...baseDoc, otp: "999999" });
      repo.updateDocument.mockResolvedValue({} as any);
      await expect(service.claimDocument("doc-id", "000000")).rejects.toThrow(
        "Incorrect OTP.",
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
      const dto = { documentName: "My Doc" };
      const result = (service as any).generateFilename(dto, 123456, "John Doe");
      expect(result).toBe("John-Doe_My-Doc_123456.pdf");
    });
  });

  describe("view document", () => {
    it("should throw NotFoundException if QR code is not found", async () => {
      (prisma.qrCode.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.viewDocument("non-existent-id")).rejects.toThrow(
        new NotFoundException("QR code not found")
      );
    });

    it("should throw NotFoundException if no active QR codes are found", async () => {
      const fakeDocument = {
        documentID: "doc123",
        documentName: "Test Doc",
        uploadDate: new Date("2025-04-05T12:00:00Z"),
        publisher: "Test Publisher",
        filePath: "/path/to/file",
        // All QR codes are inactive.
        qrCode: [
          {
            id: "qr1",
            owner: "Alice",
            isActive: false,
            isPrivate: true,
            generatedDate: new Date("2025-04-05T10:00:00Z"),
            documentId: "doc123",
          },
          {
            id: "qr2",
            owner: "Alice",
            isActive: false,
            isPrivate: false,
            generatedDate: new Date("2025-04-05T10:00:00Z"),
            documentId: "doc123",
          },
        ],
      };

      const fakeQrCode = {
        id: "qr1",
        owner: "Alice",
        isActive: false,
        isPrivate: true,
        generatedDate: new Date("2025-04-05T10:00:00Z"),
        documentId: "doc123",
        document: fakeDocument,
      };

      (prisma.qrCode.findUnique as jest.Mock).mockResolvedValue(fakeQrCode);
      await expect(service.viewDocument("qr1")).rejects.toThrow(
        new NotFoundException("No active QR code found for this document")
      );
    });

    it("should throw error if more than 2 active QR codes are found", async () => {
      const fakeDocument = {
        documentID: "doc123",
        documentName: "Test Doc",
        uploadDate: new Date("2025-04-05T12:00:00Z"),
        publisher: "Test Publisher",
        filePath: "/path/to/file",
        // Simulate three active QR codes.
        qrCode: [
          {
            id: "qr1",
            owner: "Bob",
            isActive: true,
            isPrivate: true,
            generatedDate: new Date("2025-04-05T10:00:00Z"),
            documentId: "doc123",
          },
          {
            id: "qr2",
            owner: "Bob",
            isActive: true,
            isPrivate: false,
            generatedDate: new Date("2025-04-05T10:00:00Z"),
            documentId: "doc123",
          },
          {
            id: "qr3",
            owner: "Bob",
            isActive: true,
            isPrivate: true,
            generatedDate: new Date("2025-04-05T11:00:00Z"),
            documentId: "doc123",
          },
        ],
      };

      const fakeQrCode = {
        id: "qr1",
        owner: "Bob",
        isActive: true,
        isPrivate: true,
        generatedDate: new Date("2025-04-05T10:00:00Z"),
        documentId: "doc123",
        document: fakeDocument,
      };

      (prisma.qrCode.findUnique as jest.Mock).mockResolvedValue(fakeQrCode);
      await expect(service.viewDocument("qr1")).rejects.toThrow(
        "Multiple active QR codes found for this document"
      );
    });

    it("should return document details, ownershipHistory, currentOwner and filePath when qrCode is private", async () => {
      const fakeDocument = {
        documentID: "doc123",
        documentName: "Test Doc",
        uploadDate: new Date("2025-04-05T12:00:00Z"),
        publisher: "Test Publisher",
        filePath: "/path/to/file",
        // Two ownership events: one for an older pair and one for the active pair.
        qrCode: [
          // Older (inactive) pair.
          {
            id: "qr1",
            owner: "Alice",
            isActive: false,
            isPrivate: true,
            generatedDate: new Date("2025-04-05T08:00:00Z"),
            documentId: "doc123",
          },
          {
            id: "qr2",
            owner: "Alice",
            isActive: false,
            isPrivate: false,
            generatedDate: new Date("2025-04-05T08:00:00Z"),
            documentId: "doc123",
          },
          // Active pair with identical generatedDate.
          {
            id: "qr3",
            owner: "Bob",
            isActive: true,
            isPrivate: true,
            generatedDate: new Date("2025-04-05T10:00:00Z"),
            documentId: "doc123",
          },
          {
            id: "qr4",
            owner: "Bob",
            isActive: true,
            isPrivate: false,
            generatedDate: new Date("2025-04-05T10:00:00Z"),
            documentId: "doc123",
          },
        ],
      };

      // Query using one of the active private QR codes.
      const fakeQrCode = {
        id: "qr3",
        owner: "Bob",
        isActive: true,
        isPrivate: true,
        generatedDate: new Date("2025-04-05T10:00:00Z"),
        documentId: "doc123",
        document: fakeDocument,
      };

      (prisma.qrCode.findUnique as jest.Mock).mockResolvedValue(fakeQrCode);
      const result = await service.viewDocument("qr3");

      // Document details.
      expect(result.documentId).toEqual("doc123");
      expect(result.documentName).toEqual("Test Doc");
      expect(result.uploadDate).toEqual(new Date("2025-04-05T12:00:00Z"));
      expect(result.publisher).toEqual("Test Publisher");
      // filePath is included because the queried QR code is private.
      expect(result.filePath).toEqual("/path/to/file");
      // currentOwner should be "Bob" (from active QR codes).
      expect(result.currentOwner).toEqual("Bob");
      // Ownership history deduplicates by generatedDate: two unique events expected.
      expect(result.ownershipHistory).toHaveLength(2);
      expect(result.ownershipHistory[0]).toEqual({
        owner: "Alice",
        generatedDate: new Date("2025-04-05T08:00:00Z"),
      });
      expect(result.ownershipHistory[1]).toEqual({
        owner: "Bob",
        generatedDate: new Date("2025-04-05T10:00:00Z"),
      });
    });

    it("should return document details, ownershipHistory, currentOwner and no filePath when qrCode is public", async () => {
      const fakeDocument = {
        documentID: "doc123",
        documentName: "Test Doc",
        uploadDate: new Date("2025-04-05T12:00:00Z"),
        publisher: "Test Publisher",
        filePath: "/path/to/file",
        qrCode: [
          {
            id: "qr1",
            owner: "Alice",
            isActive: false,
            isPrivate: true,
            generatedDate: new Date("2025-04-05T08:00:00Z"),
            documentId: "doc123",
          },
          {
            id: "qr2",
            owner: "Alice",
            isActive: false,
            isPrivate: false,
            generatedDate: new Date("2025-04-05T08:00:00Z"),
            documentId: "doc123",
          },
          {
            id: "qr3",
            owner: "Bob",
            isActive: true,
            isPrivate: false,
            generatedDate: new Date("2025-04-05T10:00:00Z"),
            documentId: "doc123",
          },
          {
            id: "qr4",
            owner: "Bob",
            isActive: true,
            isPrivate: true,
            generatedDate: new Date("2025-04-05T10:00:00Z"),
            documentId: "doc123",
          },
        ],
      };

      // Query using a public QR code from the active pair.
      const fakeQrCode = {
        id: "qr3",
        owner: "Bob",
        isActive: true,
        isPrivate: false,
        generatedDate: new Date("2025-04-05T10:00:00Z"),
        documentId: "doc123",
        document: fakeDocument,
      };

      (prisma.qrCode.findUnique as jest.Mock).mockResolvedValue(fakeQrCode);
      const result = await service.viewDocument("qr3");

      expect(result.documentId).toEqual("doc123");
      expect(result.documentName).toEqual("Test Doc");
      expect(result.uploadDate).toEqual(new Date("2025-04-05T12:00:00Z"));
      expect(result.publisher).toEqual("Test Publisher");
      // When the requested QR code is public, filePath should not be included.
      expect(result.filePath).toBeUndefined();
      expect(result.currentOwner).toEqual("Bob");
      expect(result.ownershipHistory).toHaveLength(2);
    });
  });
});
