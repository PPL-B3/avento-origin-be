import * as AWS from "aws-sdk";
import * as fs from "fs";
import * as path from "path";
import { ConfigService } from "@nestjs/config";
import { DocumentService } from "./document.service";
import { Test, TestingModule } from "@nestjs/testing";

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
  let bucket: AWS.S3;
  let mockFile: Express.Multer.File;

  beforeEach(async () => {
    process.env.DO_SPACES_BUCKET = "test-bucket";

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentService,
        {
          provide: ConfigService,
          useValue: {
            // Jest mock for the `get` method
            get: (key: string) => {
              const config = {
                DO_SPACES_ENDPOINT: "https://example-endpoint.com",
                DO_SPACES_KEY: "exampleAccessKey",
                DO_SPACES_SECRET: "exampleSecretKey",
                DO_SPACES_REGION: "example-region",
                DO_SPACES_BUCKET: "example-bucket", // Change this value to test the conditional logic if needed
              };
              return config[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);
    configService = module.get<ConfigService>(ConfigService);
    bucket = new AWS.S3();

    // Load the actual PDF file as a Buffer.
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should throw an error if DO_SPACES_BUCKET is not set", async () => {
    // Override the get method to simulate a missing DO_SPACES_BUCKET value.
    jest.spyOn(configService, "get").mockImplementation((key: string) => {
      const config = {
        DO_SPACES_ENDPOINT: "https://example-endpoint.com",
        DO_SPACES_KEY: "exampleAccessKey",
        DO_SPACES_SECRET: "exampleSecretKey",
        DO_SPACES_REGION: "example-region",
        DO_SPACES_BUCKET: undefined, // Simulate missing bucket value
      };
      return config[key];
    });
    await expect(service.uploadToBucket(mockFile, "test.pdf")).rejects.toThrow(
      "DO_SPACES_BUCKET environment variable is not defined."
    );
  });

  it("should upload a file to S3 and return the URL", async () => {
    const url = await service.uploadToBucket(mockFile, "test.pdf");

    expect(url).toBe("https://mock-url.com/document.pdf");
    expect(bucket.upload).toHaveBeenCalledWith({
      Bucket: "example-bucket",
      Key: "test.pdf",
      Body: mockFile.buffer,
      ContentType: "application/pdf",
    });
  });

  it("should return a success message with the document URL", async () => {
    const response = await service.uploadDocument(mockFile, {
      ownerName: "mock-user",
    });

    expect(response).toEqual({
      message: "Document uploaded successfully.",
      url: "https://mock-url.com/document.pdf",
    });
  });
});
