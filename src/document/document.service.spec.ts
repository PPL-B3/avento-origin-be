import * as AWS from "aws-sdk";
import * as fs from "fs";
import * as path from "path";
import { ConfigService } from "@nestjs/config";
import { DocumentService } from "./document.service";
import { PrismaService } from "../prisma/prisma.service";
import { Test, TestingModule } from "@nestjs/testing";
import { UploadDocumentDTO } from "./dto/upload-document.dto";
import { BadRequestException } from "@nestjs/common";

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: "mocked-email-id" }),
  })),
}));

jest.mock("aws-sdk", () => {
  const mockS3Instance = {
    upload: jest.fn().mockReturnThis(),
    promise: jest
      .fn()
      .mockResolvedValue({ Location: "https://mock-url.com/document.pdf" }),
  };
  return { S3: jest.fn(() => mockS3Instance) };
});

describe("DocumentService", () => {
  let docService: DocumentService;
  let configService: ConfigService;
  let prismaService: PrismaService;
  let mockFile: Express.Multer.File;
  let mockBody: UploadDocumentDTO;
  let mockDocument: any;
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
                GMAIL_USER: "test@gmail.com",
                GMAIL_PASS: "testpass",
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
    mockBody = { documentName: "Test Document", ownerName: "John Doe" };

    mockDocument = {
      documentID: "doc-id",
      documentName: "Test Document",
      filePath: "https://example.com/doc.pdf",
      uploadDate: new Date(),
      publisher: "John Doe",
      qrCode: [{ id: "qr1", owner: "PublicOwner", isPrivate: false }],
      pendingOwner: null,
      otp: null,
      otpExpiry: null,
      otpAttemptCount: 0,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(docService).toBeDefined();
  });

  it("should throw error if DO_SPACES_BUCKET is not set", async () => {
    jest.spyOn(configService, "get").mockReturnValueOnce(undefined);
    await expect(
      docService.uploadToBucket(mockFile, mockBody, Date.now())
    ).rejects.toThrow("DO_SPACES_BUCKET environment variable is not defined.");
  });

  it("should upload file to S3 and return URL", async () => {
    const timestamp = Date.now();
    const url = await docService.uploadToBucket(mockFile, mockBody, timestamp);
    expect(url).toBe("https://mock-url.com/document.pdf");
    const sanitizedOwner = mockBody.ownerName.replace(/\s+/g, "-");
    const sanitizedDoc = mockBody.documentName.replace(/\s+/g, "-");
    const expectedFilename = `${sanitizedOwner}_${sanitizedDoc}_${timestamp}.pdf`;
    expect(bucket.upload).toHaveBeenCalledWith({
      Bucket: "example-bucket",
      Key: expectedFilename,
      Body: mockFile.buffer,
      ContentType: "application/pdf",
    });
  });

  it("should handle S3 upload errors", async () => {
    jest.spyOn(bucket, "upload").mockReturnValueOnce({
      promise: jest.fn().mockRejectedValue(new Error("S3 Upload Failed")),
    } as any);
    await expect(
      docService.uploadToBucket(mockFile, mockBody, Date.now())
    ).rejects.toThrow("S3 Upload Failed");
  });

  it("should store document info in database after upload", async () => {
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

  it("should handle database errors on upload", async () => {
    jest
      .spyOn(prismaService.document, "create")
      .mockRejectedValueOnce(new Error("Database Error"));
    await expect(docService.uploadDocument(mockFile, mockBody)).rejects.toThrow(
      "Database Error"
    );
  });

  it("should throw BadRequestException for invalid email format in transferDocument", async () => {
    await expect(
      docService.transferDocument("doc-id", "invalid-email")
    ).rejects.toThrow(new BadRequestException("Invalid email format."));
  });

  it("should throw BadRequestException if document not found in transferDocument", async () => {
    jest.spyOn(prismaService.document, "findUnique").mockResolvedValue(null);
    await expect(
      docService.transferDocument("doc-id", "test@example.com")
    ).rejects.toThrow(new BadRequestException("Document not found."));
  });

  it("should generate OTP, update document, and send email (with public QR code)", async () => {
    jest
      .spyOn(prismaService.document, "findUnique")
      .mockResolvedValue(mockDocument);
    const updateSpy = jest
      .spyOn(prismaService.document, "update")
      .mockResolvedValue({
        ...mockDocument,
        pendingOwner: "test@example.com",
        otp: "000000",
        otpExpiry: new Date(Date.now() + 8 * 60 * 1000),
        otpAttemptCount: 0,
      });
    const sendMailSpy = jest
      .spyOn(docService["transporter"], "sendMail")
      .mockResolvedValueOnce({});

    const result = await docService.transferDocument(
      "doc-id",
      "test@example.com"
    );
    expect(result).toHaveProperty("otp");
    expect(result.otp).toMatch(/^\d{6}$/);
    expect(updateSpy).toHaveBeenCalledWith({
      where: { documentID: "doc-id" },
      data: {
        pendingOwner: "test@example.com",
        otp: expect.any(String),
        otpExpiry: expect.any(Date),
        otpAttemptCount: 0,
      },
    });
    expect(sendMailSpy).toHaveBeenCalled();
  });

  it("should generate OTP and throw error if email sending fails", async () => {
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
    jest
      .spyOn(docService["transporter"], "sendMail")
      .mockRejectedValueOnce(new Error("Email Failed"));
    await expect(
      docService.transferDocument("doc-id", "test@example.com")
    ).rejects.toThrow("Gagal mengirim email: Email Failed");
  });

  it("should use document.publisher if no public QR code is found", async () => {
    const mockDocumentNoPublicQR = {
      ...mockDocument,
      qrCode: [{ id: "qr1", owner: "Alice", isPrivate: true }], // No public QR codes.
    };

    jest
      .spyOn(prismaService.document, "findUnique")
      .mockResolvedValue(mockDocumentNoPublicQR);

    jest.spyOn(prismaService.document, "update").mockResolvedValue({
      ...mockDocumentNoPublicQR,
      pendingOwner: "test@example.com",
      otp: "123456",
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
