import * as AWS from "aws-sdk";
import * as fs from "fs";
import * as path from "path";
import { ConfigService } from "@nestjs/config";
import { DocumentService } from "./document.service";
import { PrismaService } from "../prisma/prisma.service";
import { Test, TestingModule } from "@nestjs/testing";
import { UploadDocumentDTO } from "./dto/upload-document.dto";
import { BadRequestException } from "@nestjs/common/exceptions";

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
  let docService: DocumentService;
  let configService: ConfigService;
  let prismaService: PrismaService;
  let mockFile: Express.Multer.File;
  let mockBody: UploadDocumentDTO;
  let bucket: AWS.S3;

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
                publisher: "John Doe",
              }),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    docService = module.get<DocumentService>(DocumentService);
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
    expect(docService).toBeDefined();
  });

  it("should throw an error if DO_SPACES_BUCKET is not set", async () => {
    jest.spyOn(configService, "get").mockReturnValueOnce(undefined);

    await expect(
      docService.uploadToBucket(mockFile, mockBody, Date.now())
    ).rejects.toThrow("DO_SPACES_BUCKET environment variable is not defined.");
  });

  it("should upload a file to S3 and return the URL", async () => {
    const timestamp = Date.now();
    const url = await docService.uploadToBucket(mockFile, mockBody, timestamp);

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
      docService.uploadToBucket(mockFile, mockBody, Date.now())
    ).rejects.toThrow("S3 Upload Failed");
  });

  it("should store document info in the database after upload", async () => {
    const response = await docService.uploadDocument(mockFile, mockBody);

    expect(response).toEqual({
      documentName: mockBody.documentName,
      filePath: "https://mock-url.com/document.pdf",
      uploadDate: expect.any(Date),
      publisher: mockBody.ownerName,
    });

    expect(prismaService.document.create).toHaveBeenCalledWith({
      data: {
        documentName: mockBody.documentName,
        filePath: "https://mock-url.com/document.pdf",
        uploadDate: expect.any(Date),
        publisher: mockBody.ownerName,
      },
    });
  });

  it("should handle database errors properly", async () => {
    jest
      .spyOn(prismaService.document, "create")
      .mockRejectedValueOnce(new Error("Database Error"));

    await expect(docService.uploadDocument(mockFile, mockBody)).rejects.toThrow(
      "Database Error"
    );
  });

  it("should throw BadRequestException for invalid email format", async () => {
    await expect(
      docService.transferDocument("doc-id", "invalid-email")
    ).rejects.toThrow(new BadRequestException("Invalid email format."));
  });

  it("should throw BadRequestException if document is not found", async () => {
    jest.spyOn(prismaService.document, "findUnique").mockResolvedValue(null);

    await expect(
      docService.transferDocument("doc-id", "test@example.com")
    ).rejects.toThrow(new BadRequestException("Document not found."));
  });

  it("should generate OTP, store it, and return the OTP", async () => {
    const mockDocument = {
      documentID: "doc-id",
      documentName: "Test Document",
      filePath: "https://example.com/doc.pdf",
      uploadDate: new Date(),
      publisher: "John Doe",
      pendingOwner: null,
      otp: null,
      otpExpiry: null,
      otpAttemptCount: 0,
    };
    jest
      .spyOn(prismaService.document, "findUnique")
      .mockResolvedValue(mockDocument);
    jest.spyOn(prismaService.document, "update").mockResolvedValue({
      ...mockDocument,
      pendingOwner: "test@example.com",
      otp: "000000",
      otpExpiry: new Date(Date.now() + 8 * 60 * 1000),
      otpAttemptCount: 0,
    });

    const result = await docService.transferDocument(
      "doc-id",
      "test@example.com"
    );

    expect(result).toHaveProperty("otp");
    expect(result.otp).toMatch(/^\d{6}$/);
    expect(prismaService.document.update).toHaveBeenCalledWith({
      where: { documentID: "doc-id" },
      data: {
        pendingOwner: "test@example.com",
        otp: expect.any(String),
        otpExpiry: expect.any(Date),
        otpAttemptCount: 0,
      },
    });
  });
});
