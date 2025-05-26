import { BadRequestException } from "@nestjs/common";
import { DocumentRepository } from "./document.repository";
import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "@prisma/client";

describe("DocumentRepository", () => {
  let repo: DocumentRepository;
  let prisma: PrismaService;
  let fakeTransaction: any;

  // Create a fake transaction client with document and qrCode namespaces.
  beforeEach(() => {
    fakeTransaction = {
      document: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      qrCode: {
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    // Fake prisma service: $transaction calls the provided callback with our fakeTransaction.
    prisma = {
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        return await cb(fakeTransaction);
      }),
      document: fakeTransaction.document,
      qrCode: fakeTransaction.qrCode,
    } as unknown as PrismaService;

    repo = new DocumentRepository(prisma);
  });

  describe("createDocument", () => {
    const createInput: Prisma.DocumentCreateInput = {
      documentName: "Test Doc",
      filePath: "/path/to/file",
      publisher: "publisher@example.com",
      size: 1024,
    };

    it("should create a document and attach QR codes successfully", async () => {
      // Fake document creation returns a document with a generated documentID.
      const fakeDoc = { documentID: "doc-123", qrCode: [] };
      fakeTransaction.document.create.mockResolvedValue(fakeDoc);
      // Simulate creation of two QR codes – one private and one public.
      fakeTransaction.qrCode.create
        .mockResolvedValueOnce({ id: "qr-private", isPrivate: true })
        .mockResolvedValueOnce({ id: "qr-public", isPrivate: false });
      fakeTransaction.document.update.mockResolvedValue({});

      const result = await repo.createDocument(createInput);
      expect(fakeTransaction.document.create).toHaveBeenCalledWith({
        data: createInput,
      });
      expect(fakeTransaction.qrCode.create).toHaveBeenCalledTimes(2);
      expect(fakeTransaction.document.update).toHaveBeenCalledWith({
        where: { documentID: "doc-123" },
        data: {
          qrCode: { connect: [{ id: "qr-private" }, { id: "qr-public" }] },
        },
      });
      expect(result).toEqual({
        documentId: "doc-123",
        privateId: "qr-private",
        publicId: "qr-public",
      });
    });

    it("should throw error if QR code generation fails (missing a QR)", async () => {
      // Create document succeeds.
      const fakeDoc = { documentID: "doc-123", qrCode: [] };
      fakeTransaction.document.create.mockResolvedValue(fakeDoc);
      // Only one QR code is properly created; second returns an object missing "isPrivate".
      fakeTransaction.qrCode.create
        .mockResolvedValueOnce({ id: "only-qr", isPrivate: true })
        .mockResolvedValueOnce({ id: "dummy-qr", isPrivate: true });
      await expect(repo.createDocument(createInput)).rejects.toThrowError(
        "Failed creating private and/or public QR codes."
      );
    });

    it("findDocumentById should use the default prisma instance when transaction is not provided", async () => {
      // Arrange: set up a fake document and mock prisma.document.findUnique on the default prisma.
      const documentId = "doc-123";
      const fakeDoc = { documentID: documentId, qrCode: [] };
      prisma.document.findUnique = jest.fn().mockResolvedValue(fakeDoc);

      // Act: call findDocumentById without passing a transaction.
      const result = await repo.findDocumentById(documentId);

      // Assert: expect prisma.document.findUnique to have been called with the proper parameters.
      expect(prisma.document.findUnique).toHaveBeenCalledWith({
        where: { documentID: documentId },
        include: {
          qrCode: {
            orderBy: {
              generatedDate: "asc",
            },
          },
        },
      });
      expect(result).toEqual(fakeDoc);
    });

    it("updateDocument should use the default prisma instance when transaction is not provided", async () => {
      // Arrange: create update data and set up a fake updated document.
      const documentId = "doc-123";
      const updateData: Prisma.DocumentUpdateInput = {
        documentName: "Updated Name",
      };
      const updatedDoc = {
        documentID: documentId,
        documentName: "Updated Name",
      };
      prisma.document.update = jest.fn().mockResolvedValue(updatedDoc);

      // Act: call updateDocument without passing a transaction.
      const result = await repo.updateDocument(documentId, updateData);

      // Assert: expect prisma.document.update to have been called with the proper parameters.
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { documentID: documentId },
        data: updateData,
      });
      expect(result).toEqual(updatedDoc);
    });
  });

  describe("changeOwnership", () => {
    const documentId = "doc-123";
    const newOwner = "newowner@example.com";
    const fakeDocument = {
      documentID: documentId,
      publisher: "publisher@example.com",
      qrCode: [
        { id: "qr-1", isPrivate: true, isActive: true },
        { id: "qr-2", isPrivate: false, isActive: true },
        // Other QR codes may exist, but only the last two are considered active.
        { id: "qr-old", isPrivate: true, isActive: false },
      ],
    };

    it("should update active QR codes to inactive and attach new ones", async () => {
      // findDocumentById is used inside changeOwnership.
      fakeTransaction.document.findUnique.mockResolvedValue(fakeDocument);
      // For each active QR code (last two), update is called.
      fakeTransaction.qrCode.update.mockResolvedValue({});
      // Simulate new QR code creation.
      fakeTransaction.qrCode.create
        .mockResolvedValueOnce({ id: "new-private", isPrivate: true })
        .mockResolvedValueOnce({ id: "new-public", isPrivate: false });
      fakeTransaction.document.update.mockResolvedValue({});

      const result = await repo.changeOwnership(
        fakeTransaction,
        newOwner,
        documentId
      );
      expect(fakeTransaction.document.findUnique).toHaveBeenCalledWith({
        where: { documentID: documentId },
        include: {
          qrCode: {
            orderBy: {
              generatedDate: "asc",
            },
          },
        },
      });
      expect(fakeTransaction.qrCode.update).toHaveBeenCalledTimes(2);
      expect(fakeTransaction.document.update).toHaveBeenCalledWith({
        where: { documentID: documentId },
        data: {
          qrCode: { connect: [{ id: "new-private" }, { id: "new-public" }] },
        },
      });
      expect(result).toEqual({
        documentId: "doc-123",
        privateId: "new-private",
        publicId: "new-public",
      });
    });

    it("should throw BadRequestException if document is not found", async () => {
      fakeTransaction.document.findUnique.mockResolvedValue(null);
      await expect(
        repo.changeOwnership(fakeTransaction, newOwner, documentId)
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw error if new QR code generation fails in changeOwnership", async () => {
      fakeTransaction.document.findUnique.mockResolvedValue(fakeDocument);
      fakeTransaction.qrCode.update.mockResolvedValue({});
      // Simulate failure: second QR code creation returns an object missing isPrivate.
      fakeTransaction.qrCode.create
        .mockResolvedValueOnce({ id: "new-private", isPrivate: true })
        .mockResolvedValueOnce({ id: "dummy-qr", isPrivate: true });
      await expect(
        repo.changeOwnership(fakeTransaction, newOwner, documentId)
      ).rejects.toThrow("Failed creating private and/or public QR codes.");
    });
  });

  describe("findDocumentById", () => {
    const documentId = "doc-123";
    it("should return document if found", async () => {
      const fakeDoc = { documentID: documentId, qrCode: [] };
      fakeTransaction.document.findUnique.mockResolvedValue(fakeDoc);
      const result = await repo.findDocumentById(documentId, fakeTransaction);
      expect(fakeTransaction.document.findUnique).toHaveBeenCalledWith({
        where: { documentID: documentId },
        include: {
          qrCode: {
            orderBy: {
              generatedDate: "asc",
            },
          },
        },
      });
      expect(result).toEqual(fakeDoc);
    });

    it("should throw BadRequestException if document not found", async () => {
      fakeTransaction.document.findUnique.mockResolvedValue(null);
      await expect(
        repo.findDocumentById(documentId, fakeTransaction)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("updateDocument", () => {
    const documentId = "doc-123";
    const updateData: Prisma.DocumentUpdateInput = {
      documentName: "Updated Name",
    };
    it("should update and return the document", async () => {
      const updatedDoc = {
        documentID: documentId,
        documentName: "Updated Name",
      };
      fakeTransaction.document.update.mockResolvedValue(updatedDoc);
      const result = await repo.updateDocument(
        documentId,
        updateData,
        fakeTransaction
      );
      expect(fakeTransaction.document.update).toHaveBeenCalledWith({
        where: { documentID: documentId },
        data: updateData,
      });
      expect(result).toEqual(updatedDoc);
    });
  });

  // Optional: Testing createQrCodeBatch indirectly via createDocument.
  describe("generateAndAttachQrCodes (via createDocument)", () => {
    it("should create exactly two QR codes with correct properties", async () => {
      const createQrCodeBatchSpy = jest.spyOn<any, any>(
        repo,
        "createQrCodeBatch"
      );
      const now = new Date();
      createQrCodeBatchSpy.mockReturnValue([
        {
          owner: "testOwner",
          isActive: true,
          generatedDate: now,
          documentId: "doc-123",
          isPrivate: false,
        },
        {
          owner: "testOwner",
          isActive: true,
          generatedDate: now,
          documentId: "doc-123",
          isPrivate: true,
        },
      ]);
      const createInput: Prisma.DocumentCreateInput = {
        documentName: "Test Doc",
        filePath: "/path/to/file",
        publisher: "testOwner",
        size: 1024,
      };
      fakeTransaction.document.create.mockResolvedValue({
        documentID: "doc-123",
        qrCode: [],
      });
      fakeTransaction.qrCode.create
        .mockResolvedValueOnce({ id: "qr-1", isPrivate: false })
        .mockResolvedValueOnce({ id: "qr-2", isPrivate: true });
      fakeTransaction.document.update.mockResolvedValue({});
      const result = await repo.createDocument(createInput);
      expect(createQrCodeBatchSpy).toHaveBeenCalledWith("testOwner", "doc-123");
      expect(result).toEqual({
        privateId: "qr-2",
        publicId: "qr-1",
        documentId: "doc-123",
      });
    });
  });
});
