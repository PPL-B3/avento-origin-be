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
    email = {
      sendOwnershipTransferEmail: jest.fn(),
      sendPrivateAccessEmail: jest.fn(),
    } as any;
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
      qrCodeOTP: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
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
      auditLog
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
        expect.stringMatching(/^alice@example\.com_My-Doc_\d+\.pdf$/)
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
          "user-id-123"
        )
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
      (prisma.user.findUniqueOrThrow as jest.Mock).mockRejectedValue(
        new Error("Not Found")
      );

      const file = {
        buffer: Buffer.from("pdf"),
        mimetype: "application/pdf",
      } as any;
      const dto = { documentName: "No Audit" };
      await expect(
        service.uploadDocument(file, dto, "ghost-user")
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
        prisma
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
      const dto = { documentName: "My Doc" };
      const result = (service as any).generateFilename(dto, 123456, "John Doe");
      expect(result).toBe("John-Doe_My-Doc_123456.pdf");
    });

    it("should calculate remaining minutes correctly (rounding up)", () => {
      const now = new Date("2025-04-26T10:00:00.000Z");
      const cooldown = new Date("2025-04-26T10:04:30.000Z"); // 4.5 mins later
      const result = (service as any).getRetryText(cooldown, now);
      expect(result).toBe("Retry in 5 minute(s).");
    });

    it("should show 1 minute for less than a minute remaining", () => {
      const now = new Date("2025-04-26T10:00:00.000Z");
      const cooldown = new Date("2025-04-26T10:00:15.000Z"); // 15 seconds later
      const result = (service as any).getRetryText(cooldown, now);
      expect(result).toBe("Retry in 1 minute(s).");
    });
  });

  describe("view document", () => {
    it("should throw NotFoundException if QR code is not found", async () => {
      (prisma.qrCode.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.viewDocument("non-existent-id")).rejects.toThrow(
        new NotFoundException("QR code not found")
      );
    });

    it("should throw BadRequestException when QR code is not active", async () => {
      (prisma.qrCode.findUnique as jest.Mock).mockResolvedValue({
        id: "qr-inactive",
        isActive: false,
      } as any);

      await expect(service.viewDocument("qr-inactive")).rejects.toThrow(
        new BadRequestException("QR code exists but is inactive")
      );
      expect(prisma.qrCode.findUnique).toHaveBeenCalledWith({
        where: { id: "qr-inactive" },
        include: {
          document: {
            include: {
              qrCode: {
                orderBy: { generatedDate: "asc" },
              },
            },
          },
        },
      });
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

  describe("requestQrCodeOTP", () => {
    const qrId = "valid-private-qr-id";
    const mockQrCode = {
      id: qrId,
      isActive: true,
      isPrivate: true,
      owner: "owner@example.com",
      document: { documentName: "Private Doc" },
    };
    const mockOtp = "654321";

    beforeEach(() => {
      // Reset mocks before each test in this describe block
      jest.clearAllMocks();
      // Mock generateOtp if it's a method of the class
      jest.spyOn(service as any, "generateOtp").mockReturnValue(mockOtp);
      // Mock getRetryText if needed, or rely on its use in error messages
      jest
        .spyOn(service as any, "getRetryText")
        .mockImplementation(
          (cooldown, now) =>
            `Retry in ${Math.ceil(
              ((cooldown as Date).getTime() - (now as Date).getTime()) / 60000
            )} minute(s).`
        );
    });

    it("should throw error if QR code not found", async () => {
      (prisma.qrCode.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.requestQrCodeOTP(qrId)).rejects.toThrow(
        new BadRequestException("This QR code isn't for OTP requests.")
      );
      expect(prisma.qrCode.findUnique).toHaveBeenCalledWith({
        where: { id: qrId },
        include: { document: true },
      });
    });

    it("should throw error if QR code is not active", async () => {
      (prisma.qrCode.findUnique as jest.Mock).mockResolvedValue({
        ...mockQrCode,
        isActive: false,
      });
      await expect(service.requestQrCodeOTP(qrId)).rejects.toThrow(
        new BadRequestException("This QR code isn't for OTP requests.")
      );
    });

    it("should throw error if QR code is not private", async () => {
      (prisma.qrCode.findUnique as jest.Mock).mockResolvedValue({
        ...mockQrCode,
        isPrivate: false,
      });
      await expect(service.requestQrCodeOTP(qrId)).rejects.toThrow(
        new BadRequestException("This QR code isn't for OTP requests.")
      );
    });

    it("should create new OTP record if none exists", async () => {
      (prisma.qrCode.findUnique as jest.Mock).mockResolvedValue(mockQrCode);
      (prisma.qrCodeOTP.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.qrCodeOTP.create as jest.Mock).mockResolvedValue({
        id: "otp-id-1",
        qrCodeId: qrId,
        otp: mockOtp,
        /* other fields */
      });

      const result = await service.requestQrCodeOTP(qrId);

      expect(prisma.qrCodeOTP.create).toHaveBeenCalledWith({
        data: {
          qrCodeId: qrId,
          otp: mockOtp,
          expiry: expect.any(Date), // Check it's a date
          attemptCount: 0,
          cooldown: expect.any(Date), // Check it's a date
        },
      });
      expect(email.sendPrivateAccessEmail).toHaveBeenCalledWith(
        mockQrCode.owner,
        mockOtp,
        mockQrCode.document.documentName
      );
      expect(result).toEqual({
        owner: mockQrCode.owner,
        document: mockQrCode.document.documentName,
      });
    });

    it("should update OTP record if exists and not on cooldown", async () => {
      const existingOtp = {
        id: "otp-id-2",
        qrCodeId: qrId,
        otp: "111111",
        expiry: new Date(Date.now() - 10000), // Expired
        attemptCount: 1,
        cooldown: new Date(Date.now() - 10000), // Cooldown finished
      };
      (prisma.qrCode.findUnique as jest.Mock).mockResolvedValue(mockQrCode);
      (prisma.qrCodeOTP.findUnique as jest.Mock).mockResolvedValue(existingOtp);

      const result = await service.requestQrCodeOTP(qrId);

      expect(prisma.qrCodeOTP.update).toHaveBeenCalledWith({
        where: { qrCodeId: qrId },
        data: {
          otp: mockOtp,
          expiry: expect.any(Date), // Check expiry is updated
        },
      });
      expect(prisma.qrCodeOTP.create).not.toHaveBeenCalled();
      expect(email.sendPrivateAccessEmail).toHaveBeenCalledWith(
        mockQrCode.owner,
        mockOtp,
        mockQrCode.document.documentName
      );
      expect(result).toEqual({
        owner: mockQrCode.owner,
        document: mockQrCode.document.documentName,
      });
    });

    it("should throw error if on cooldown", async () => {
      const cooldownTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes cooldown
      const existingOtp = {
        id: "otp-id-3",
        qrCodeId: qrId,
        otp: "222222",
        expiry: new Date(Date.now() - 10000),
        attemptCount: 0,
        cooldown: cooldownTime,
      };
      (prisma.qrCode.findUnique as jest.Mock).mockResolvedValue(mockQrCode);
      (prisma.qrCodeOTP.findUnique as jest.Mock).mockResolvedValue(existingOtp);

      await expect(service.requestQrCodeOTP(qrId)).rejects.toThrow(
        new BadRequestException("Retry in 5 minute(s).") // Message from getRetryText mock
      );
      expect(prisma.qrCodeOTP.update).not.toHaveBeenCalled();
      expect(prisma.qrCodeOTP.create).not.toHaveBeenCalled();
      expect(email.sendPrivateAccessEmail).not.toHaveBeenCalled();
    });
  });

  describe("validateQrCodeOTP", () => {
    const qrId = "valid-private-qr-id";
    const validOtp = "123456";
    const mockQrCode = { id: qrId /* other qr fields */ }; // Assuming qrCode obj needed
    const baseQrOtp = {
      id: "otp-id-base",
      qrCodeId: qrId,
      otp: validOtp,
      expiry: new Date(Date.now() + 5 * 60 * 1000), // Expires in 5 mins
      attemptCount: 0,
      cooldown: new Date(Date.now() - 60 * 1000), // Cooldown finished
      qrCode: mockQrCode,
    };

    beforeEach(() => {
      jest.clearAllMocks();
      // Mock the transaction to just execute the callback with the mocked prisma
      prisma.$transaction = jest.fn().mockImplementation(async (callback) => {
        return await callback(prisma);
      });
      // Mock getRetryText again for this context
      jest
        .spyOn(service as any, "getRetryText")
        .mockImplementation(
          (cooldown, now) =>
            `Retry in ${Math.ceil(
              ((cooldown as Date).getTime() - (now as Date).getTime()) / 60000
            )} minute(s).`
        );
    });

    it("should throw error if OTP record not found", async () => {
      (prisma.qrCodeOTP.findUniqueOrThrow as jest.Mock).mockRejectedValue(
        new Error("Not found")
      ); // Simulate Prisma throwing
      await expect(service.validateQrCodeOTP(qrId, validOtp)).rejects.toThrow(
        "Not found"
      );
      expect(prisma.qrCodeOTP.update).not.toHaveBeenCalled();
    });

    it("should throw error if on cooldown", async () => {
      const cooldownTime = new Date(Date.now() + 10 * 60 * 1000); // 10 mins cooldown
      (prisma.qrCodeOTP.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        ...baseQrOtp,
        cooldown: cooldownTime,
      });
      await expect(service.validateQrCodeOTP(qrId, validOtp)).rejects.toThrow(
        new BadRequestException("Retry in 10 minute(s).")
      );
      expect(prisma.qrCodeOTP.update).not.toHaveBeenCalled();
    });

    it("should throw error if OTP expired", async () => {
      (prisma.qrCodeOTP.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        ...baseQrOtp,
        expiry: new Date(Date.now() - 1000), // Expired 1 second ago
      });
      await expect(service.validateQrCodeOTP(qrId, validOtp)).rejects.toThrow(
        new BadRequestException("OTP expired. Please request a new one.")
      );
      expect(prisma.qrCodeOTP.update).not.toHaveBeenCalled();
    });

    it("should throw error and increment attempts on invalid OTP (1st attempt)", async () => {
      (prisma.qrCodeOTP.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        ...baseQrOtp,
        attemptCount: 0,
      });
      (prisma.qrCodeOTP.update as jest.Mock).mockResolvedValue({}); // Mock update success

      await expect(service.validateQrCodeOTP(qrId, "invalid")).rejects.toThrow(
        new BadRequestException("Invalid OTP.")
      );

      expect(prisma.qrCodeOTP.update).toHaveBeenCalledWith({
        where: { qrCodeId: qrId },
        data: {
          attemptCount: 1, // Incremented
        },
      });
    });

    it("should throw error and increment attempts on invalid OTP (3rd attempt)", async () => {
      (prisma.qrCodeOTP.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        ...baseQrOtp,
        attemptCount: 2, // Currently 2 attempts
      });
      (prisma.qrCodeOTP.update as jest.Mock).mockResolvedValue({});

      await expect(service.validateQrCodeOTP(qrId, "invalid")).rejects.toThrow(
        new BadRequestException("Invalid OTP.")
      );

      expect(prisma.qrCodeOTP.update).toHaveBeenCalledWith({
        where: { qrCodeId: qrId },
        data: {
          attemptCount: 3, // Incremented
        },
      });
    });

    it("should throw error, reset attempts, and set cooldown on invalid OTP (4th attempt)", async () => {
      (prisma.qrCodeOTP.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        ...baseQrOtp,
        attemptCount: 3, // Currently 3 attempts
      });
      (prisma.qrCodeOTP.update as jest.Mock).mockResolvedValue({});

      await expect(service.validateQrCodeOTP(qrId, "invalid")).rejects.toThrow(
        new BadRequestException("Invalid OTP.")
      );

      expect(prisma.qrCodeOTP.update).toHaveBeenCalledWith({
        where: { qrCodeId: qrId },
        data: {
          attemptCount: 0, // Reset
          cooldown: expect.any(Date), // Cooldown set (check if roughly 1 hour ahead)
        },
      });
      // Optional: Check cooldown time more precisely if needed
      const updateCallArgs = (prisma.qrCodeOTP.update as jest.Mock).mock
        .calls[0][0];
      const expectedCooldownMin = new Date(Date.now() + 59 * 60 * 1000);
      const expectedCooldownMax = new Date(Date.now() + 61 * 60 * 1000);
      expect(updateCallArgs.data.cooldown.getTime()).toBeGreaterThanOrEqual(
        expectedCooldownMin.getTime()
      );
      expect(updateCallArgs.data.cooldown.getTime()).toBeLessThanOrEqual(
        expectedCooldownMax.getTime()
      );
    });

    it("should return qrCode, reset attempts, and update expiry on valid OTP", async () => {
      (prisma.qrCodeOTP.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        ...baseQrOtp,
        attemptCount: 2, // Had previous attempts
      });
      (prisma.qrCodeOTP.update as jest.Mock).mockResolvedValue({});

      const result = await service.validateQrCodeOTP(qrId, validOtp);

      expect(prisma.qrCodeOTP.update).toHaveBeenCalledWith({
        where: { qrCodeId: qrId },
        data: {
          attemptCount: 0, // Reset on success
          expiry: expect.any(Date), // Set expiry to now
        },
      });
      // Check expiry is set to roughly 'now'
      const updateCallArgs = (prisma.qrCodeOTP.update as jest.Mock).mock
        .calls[0][0];
      expect(updateCallArgs.data.expiry.getTime()).toBeLessThanOrEqual(
        Date.now()
      );
      expect(updateCallArgs.data.expiry.getTime()).toBeGreaterThanOrEqual(
        Date.now() - 5000
      ); // Allow 5s tolerance

      expect(result).toEqual(mockQrCode); // Should return the nested qrCode object
    });

    it("should validate OTP case-insensitively", async () => {
      (prisma.qrCodeOTP.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        ...baseQrOtp,
        otp: "AbCdEf", // Stored OTP
      });
      (prisma.qrCodeOTP.update as jest.Mock).mockResolvedValue({});

      // Validate with different case
      const result = await service.validateQrCodeOTP(qrId, "aBcDeF");

      expect(prisma.qrCodeOTP.update).toHaveBeenCalledWith({
        where: { qrCodeId: qrId },
        data: {
          attemptCount: 0,
          expiry: expect.any(Date),
        },
      });
      expect(result).toEqual(mockQrCode);
    });
  });

  describe("reverseOwnership", () => {
    let service: DocumentService;
    let repo: jest.Mocked<DocumentRepository>;
    let prisma: jest.Mocked<PrismaService>;
    let auditLog: jest.Mocked<AuditLogService>;

    beforeEach(() => {
      repo = {
        findDocumentById: jest.fn(),
        changeOwnership: jest.fn(),
      } as any;
      prisma = {
        $transaction: jest.fn().mockImplementation((fn) => fn(prisma)),
        user: {
          findFirst: jest.fn(),
        },
      } as any;
      auditLog = {
        addAuditLog: jest.fn(),
      } as any;

      // We don't need other dependencies for this test
      service = new DocumentService(
        null as any, // s3Storage
        repo,
        null as any, // emailService
        null as any, // config
        null as any, // posthog
        prisma,
        auditLog
      );
    });

    it("should throw BadRequestException when index is out of range", async () => {
      const qrCodes = Array(4).fill({
        owner: "owner",
        id: "id",
        isActive: true,
        isPrivate: false,
        generatedDate: new Date(),
        documentId: "doc",
      });
      repo.findDocumentById.mockResolvedValue({
        documentID: "doc",
        qrCode: qrCodes,
      } as any);

      await expect(service.reverseOwnership("doc", 2)).rejects.toBeInstanceOf(
        BadRequestException
      );

      expect(repo.findDocumentById).toHaveBeenCalledWith("doc", prisma);
      expect(repo.changeOwnership).not.toHaveBeenCalled();
      expect(auditLog.addAuditLog).not.toHaveBeenCalled();
    });

    it("should reverse ownership and record an audit log", async () => {
      // Arrange
      const documentId = "doc-id";
      const qrCodes = [
        {
          owner: "prevOwner",
          id: "a",
          isActive: true,
          isPrivate: false,
          generatedDate: new Date(),
          documentId,
        },
        {
          owner: "x",
          id: "b",
          isActive: true,
          isPrivate: true,
          generatedDate: new Date(),
          documentId,
        },
        {
          owner: "activeOwner",
          id: "c",
          isActive: false,
          isPrivate: false,
          generatedDate: new Date(),
          documentId,
        },
        {
          owner: "z",
          id: "d",
          isActive: false,
          isPrivate: true,
          generatedDate: new Date(),
          documentId,
        },
      ];
      repo.findDocumentById.mockResolvedValue({
        documentID: documentId,
        qrCode: qrCodes,
      } as any);
      repo.changeOwnership.mockResolvedValue(null as any);
      const admin = { id: "admin-123" };
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(admin);

      // Act
      await service.reverseOwnership(documentId, 0);

      // Assert
      expect(repo.findDocumentById).toHaveBeenCalledWith(documentId, prisma);
      expect(repo.changeOwnership).toHaveBeenCalledWith(
        prisma,
        "prevOwner",
        documentId
      );
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      expect(auditLog.addAuditLog).toHaveBeenCalledWith({
        eventType: "REVERSE_OWNERSHIP",
        userID: admin.id,
        details: `Ownership reversed from activeOwner to prevOwner.`,
        documentID: documentId,
      });
    });
  });
});
