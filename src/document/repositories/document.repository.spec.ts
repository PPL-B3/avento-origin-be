import { Test, TestingModule } from "@nestjs/testing";
import { DocumentRepository } from "../repositories/document.repository";
import { PrismaService } from "../../prisma/prisma.service";
import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

const dummyQrCodes = [
  {
    id: "qr1",
    owner: "owner1",
    isPrivate: true,
    isActive: true,
    generatedDate: new Date(),
    documentId: "doc-id-123",
  },
  {
    id: "qr2",
    owner: "owner1",
    isPrivate: false,
    isActive: true,
    generatedDate: new Date(),
    documentId: "doc-id-123",
  },
];

const dummyDocument = {
  documentID: "doc-id-123",
  documentName: "Test Document",
  filePath: "https://example.com/test.pdf",
  uploadDate: new Date(),
  publisher: "test@example.com",
  pendingOwner: null,
  otp: null,
  otpExpiry: null,
  otpAttemptCount: 0,
  qrCode: dummyQrCodes,
};

// Create a mock TransactionClient that satisfies Prisma.TransactionClient.
const mockTransactionClient = {
  document: {
    create: jest.fn().mockResolvedValue({ documentID: "doc-id-123" }),
    update: jest.fn().mockResolvedValue(dummyDocument),
    findUnique: jest.fn().mockResolvedValue(dummyDocument),
  },
  qrCode: {
    create: jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        ...data,
        id: "generated-" + (data.isPrivate ? "private" : "public"),
      })
    ),
    update: jest.fn().mockResolvedValue({}),
  },
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
  $use: jest.fn(),
} as unknown as Prisma.TransactionClient;

describe("DocumentRepository", () => {
  let repo: DocumentRepository;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentRepository,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((cb) => cb(mockTransactionClient)),
            document: {
              findUnique: jest.fn().mockResolvedValue(dummyDocument),
              update: jest.fn().mockResolvedValue(dummyDocument),
            },
            qrCode: {
              create: jest.fn().mockImplementation(({ data }) =>
                Promise.resolve({
                  ...data,
                  id: "generated-" + (data.isPrivate ? "private" : "public"),
                })
              ),
              update: jest.fn().mockResolvedValue({}),
            },
          },
        },
      ],
    }).compile();

    repo = module.get<DocumentRepository>(DocumentRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createDocument", () => {
    it("should create document and attach QR codes", async () => {
      const createData = {
        documentName: "Test Document",
        filePath: "https://example.com/test.pdf",
        uploadDate: new Date(),
        publisher: "test@example.com",
      };

      const result = await repo.createDocument(createData);
      expect(result).toHaveProperty("privateId");
      expect(result).toHaveProperty("publicId");

      // Ensure two QR codes were created.
      expect(mockTransactionClient.qrCode.create).toHaveBeenCalledTimes(2);
      // And that the document update connects the new QR codes.
      expect(mockTransactionClient.document.update).toHaveBeenCalledWith({
        where: { documentID: "doc-id-123" },
        data: { qrCode: { connect: expect.any(Array) } },
      });
    });

    it("should throw error if QR code generation fails", async () => {
      // Force failure by returning two private QR codes.
      jest
        .spyOn(repo as any, "createQrCodeBatch")
        .mockReturnValue([{ isPrivate: true }, { isPrivate: true }]);
      await expect(
        repo.createDocument({
          documentName: "Test Document",
          filePath: "https://example.com/test.pdf",
          uploadDate: new Date(),
          publisher: "test@example.com",
        })
      ).rejects.toThrow("Failed creating private and/or public QR codes.");
    });
  });

  describe("changeOwnership", () => {
    it("should update active QR codes and generate new ones", async () => {
      const spy = jest.spyOn(repo as any, "generateAndAttachQrCodes");
      await repo.changeOwnership(
        mockTransactionClient,
        "newowner@example.com",
        dummyDocument.documentID
      );
      expect(mockTransactionClient.qrCode.update).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("findDocumentById", () => {
    it("should return document if found", async () => {
      const result = await repo.findDocumentById(dummyDocument.documentID);
      expect(result).toEqual(dummyDocument);
    });

    it("should throw BadRequestException if not found", async () => {
      jest.spyOn(prisma.document, "findUnique").mockResolvedValueOnce(null);
      await expect(repo.findDocumentById("non-existent")).rejects.toThrow(
        new BadRequestException("Document not found.")
      );
    });
  });

  describe("updateDocument", () => {
    it("should update document with given data", async () => {
      const updateData = { pendingOwner: "pending@example.com" };
      const result = await repo.updateDocument(
        dummyDocument.documentID,
        updateData
      );
      expect(result).toEqual(dummyDocument);
    });
  });
});
