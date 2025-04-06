import * as AWS from "aws-sdk";
import * as fs from "fs";
import * as path from "path";
import { ConfigService } from "@nestjs/config";
import { DocumentService } from "./document.service";
import { PrismaService } from "../prisma/prisma.service";
import { Test, TestingModule } from "@nestjs/testing";
import { UploadDocumentDTO } from "./dto/upload-document.dto";
import {
  GetBucketOwnershipControlsCommand,
  OwnerOverride,
} from "@aws-sdk/client-s3";
import { NotFoundException } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

jest.mock("aws-sdk", () => {
  const mockS3Instance = {
    upload: jest.fn().mockReturnThis(),
    promise: jest
      .fn()
      .mockResolvedValue({ Location: "https://mock-url.com/document.pdf" }),
  };

  return {
    S3: jest.fn(() => mockS3Instance),
  };
});

describe("DocumentService", () => {
  let service: DocumentService;
  let configService: ConfigService;
  let prismaService: PrismaService;
  let mockFile: Express.Multer.File;
  let mockBody: UploadDocumentDTO;
  let bucket: AWS.S3;

  const mockDocument = {
    documentID: "123",
    documentName: "file",
    filePath: "file.txt",
    uploadDate: new Date(Date.now()),
    publisher: "publisher",
    ownerCount: 1,
    qrCode: [],
  };

  // Example IDs for private and public QR codes
  const privateId = "private123";
  const publicId = "public123";

  // A sample QR code record that includes the related document
  const mockQRCodeRecord = {
    id: privateId,
    owner: "Owner1",
    isPrivate: true,
    isActive: false,
    generatedDate: new Date("2025-04-05T14:20:53.792Z"),
    ownerNumber: 1,
    documentId: mockDocument.documentID,
    document: mockDocument,
  };

  // Related QR codes for the same document. Notice that one of these is active.
  const mockRelatedQRCodes = [
    {
      id: privateId,
      owner: "Owner1",
      isPrivate: true,
      isActive: false,
      generatedDate: new Date("2025-04-05T14:20:53.792Z"),
      ownerNumber: 1,
      documentId: mockDocument.documentID,
    },
    {
      id: publicId,
      owner: "Owner1",
      isPrivate: false,
      isActive: true, // active QR code
      generatedDate: new Date("2025-04-06T10:00:00Z"),
      ownerNumber: 1,
      documentId: mockDocument.documentID,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                DO_SPACES_ENDPOINT: "https://example-endpoint.com",
                DO_SPACES_KEY: "exampleAccessKey",
                DO_SPACES_SECRET: "exampleSecretKey",
                DO_SPACES_REGION: "example-region",
                DO_SPACES_BUCKET: "example-bucket",
              };
              return config[key];
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            document: {
              create: jest.fn().mockResolvedValue({
                documentName: "Test Document",
                filePath: "https://mock-url.com/document.pdf",
                uploadDate: new Date(),
                ownerCount: 1,
                publisher: "John Doe",
              }),
            },
            qRCode: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);
    configService = module.get<ConfigService>(ConfigService);
    prismaService = module.get<PrismaService>(PrismaService);
    bucket = new AWS.S3();

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
    expect(service).toBeDefined();
  });

  it("should throw an error if DO_SPACES_BUCKET is not set", async () => {
    jest.spyOn(configService, "get").mockReturnValueOnce(undefined);

    await expect(
      service.uploadToBucket(mockFile, mockBody, Date.now()),
    ).rejects.toThrow("DO_SPACES_BUCKET environment variable is not defined.");
  });

  it("should upload a file to S3 and return the URL", async () => {
    const timestamp = Date.now();
    const url = await service.uploadToBucket(mockFile, mockBody, timestamp);

    expect(url).toBe("https://mock-url.com/document.pdf");

    const sanitizedOwnerName = mockBody.ownerName.replace(/\s+/g, "-");
    const sanitizedDocName = mockBody.documentName.replace(/\s+/g, "-");
    const expectedFilename = `${sanitizedOwnerName}_${sanitizedDocName}_${timestamp}.pdf`;

    expect(bucket.upload).toHaveBeenCalledWith({
      Bucket: "example-bucket",
      Key: expectedFilename,
      Body: mockFile.buffer,
      ContentType: "application/pdf",
    });
  });

  it("should handle upload errors properly", async () => {
    jest.spyOn(bucket, "upload").mockReturnValueOnce({
      promise: jest.fn().mockRejectedValue(new Error("S3 Upload Failed")),
    } as any);

    await expect(
      service.uploadToBucket(mockFile, mockBody, Date.now()),
    ).rejects.toThrow("S3 Upload Failed");
  });

  it("should store document info in the database after upload", async () => {
    const response = await service.uploadDocument(mockFile, mockBody);

    expect(response).toEqual({
      documentName: mockBody.documentName,
      filePath: "https://mock-url.com/document.pdf",
      ownerCount: 1,
      uploadDate: expect.any(Date),
      publisher: mockBody.ownerName,
    });

    expect(prismaService.document.create).toHaveBeenCalledWith({
      data: {
        documentName: mockBody.documentName,
        filePath: "https://mock-url.com/document.pdf",
        ownerCount: 1,
        uploadDate: expect.any(Date),
        publisher: mockBody.ownerName,
      },
    });
  });

  it("should handle database errors properly", async () => {
    jest
      .spyOn(prismaService.document, "create")
      .mockRejectedValueOnce(new Error("Database Error"));

    await expect(service.uploadDocument(mockFile, mockBody)).rejects.toThrow(
      "Database Error",
    );
  });

  it("should return correct document info, ownership history, and currentOwner when exactly one active QR code is found (positive case)", async () => {
    // Simulate a valid QR code lookup.
    jest
      .spyOn(prismaService.qRCode, "findUnique")
      .mockResolvedValue(mockQRCodeRecord);
    // Return related QR codes including one active QR code.
    jest
      .spyOn(prismaService.qRCode, "findMany")
      .mockResolvedValue(mockRelatedQRCodes);

    const result = await service.viewDocument(privateId);
    expect(result.documentName).toEqual(mockDocument.documentName);
    expect(result.publisher).toEqual(mockDocument.publisher);
    // Ownership history should have one unique event based on ownershipSequence.
    expect(result.ownershipHistory.length).toBe(1);
    // The current owner is determined by the active QR code.
    expect(result.currentOwner).toEqual("Owner1");
    // Since the initial QR code is private, filePath is included.
    expect(result.filePath).toEqual(mockDocument.filePath);
  });

  it("should throw NotFoundException if no active QR code is found", async () => {
    // Simulate valid QR code lookup.
    jest
      .spyOn(prismaService.qRCode, "findUnique")
      .mockResolvedValue(mockQRCodeRecord);
    // Simulate related QR codes with no active QR code.
    const noActiveQRCodes = mockRelatedQRCodes.map((qr) => ({
      ...qr,
      isActive: false,
    }));
    jest
      .spyOn(prismaService.qRCode, "findMany")
      .mockResolvedValue(noActiveQRCodes);

    await expect(service.viewDocument(privateId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("should throw an error if multiple active QR codes are found", async () => {
    // Simulate valid QR code lookup.
    jest
      .spyOn(prismaService.qRCode, "findUnique")
      .mockResolvedValue(mockQRCodeRecord);
    // Simulate related QR codes with two active QR codes.
    const multipleActiveQRCodes = [
      ...mockRelatedQRCodes,
      {
        id: "anotherActive",
        owner: "Owner2",
        isPrivate: false,
        isActive: true,
        generatedDate: new Date("2025-04-06T10:05:00Z"),
        ownerNumber: 2,
        documentId: mockDocument.documentID,
      },
    ];
    jest
      .spyOn(prismaService.qRCode, "findMany")
      .mockResolvedValue(multipleActiveQRCodes);

    await expect(service.viewDocument(privateId)).rejects.toThrow(
      "Multiple active QR codes found for this document",
    );
  });

  it("should handle PrismaClientKnownRequestError when findUnique fails", async () => {
    // Simulate a Prisma known error during findUnique.
    jest.spyOn(prismaService.qRCode, "findUnique").mockRejectedValue(
      new PrismaClientKnownRequestError("Test error", {
        code: "P2025",
        clientVersion: "6.5.0",
      }),
    );

    await expect(service.viewDocument(privateId)).rejects.toThrow(
      PrismaClientKnownRequestError,
    );
  });

  it("should throw NotFoundException if QR code is not found", async () => {
    jest.spyOn(prismaService.qRCode, "findUnique").mockResolvedValue(null);
    await expect(service.viewDocument(privateId)).rejects.toThrow(
      new NotFoundException("QR code not found"),
    );
  });
});
