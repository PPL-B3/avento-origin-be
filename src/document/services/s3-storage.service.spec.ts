import { Test, TestingModule } from "@nestjs/testing";
import { S3StorageService } from "../services/s3-storage.service";
import { ConfigService } from "@nestjs/config";
import * as AWS from "aws-sdk";

describe("S3StorageService", () => {
  let service: S3StorageService;
  let configService: ConfigService;
  let s3Instance: AWS.S3;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                DO_SPACES_ENDPOINT: "https://do.spaces.endpoint",
                DO_SPACES_KEY: "access-key",
                DO_SPACES_SECRET: "secret-key",
                DO_SPACES_REGION: "region-test",
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<S3StorageService>(S3StorageService);
    configService = module.get<ConfigService>(ConfigService);
    // Access the private s3 instance via type casting.
    s3Instance = (service as any).s3;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("uploadPDF", () => {
    it("should upload PDF and return URL", async () => {
      const fakeLocation = "https://do.spaces.endpoint/bucket/file.pdf";
      const uploadMock = jest.spyOn(s3Instance, "upload").mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Location: fakeLocation }),
      } as any);
      const buffer = Buffer.from("dummy");
      const url = await service.uploadPDF(
        buffer,
        "application/pdf",
        "bucket-test",
        "filename.pdf"
      );
      expect(url).toEqual(fakeLocation);
      expect(uploadMock).toHaveBeenCalledWith({
        Bucket: "bucket-test",
        Key: "filename.pdf",
        Body: buffer,
        ContentType: "application/pdf",
      });
    });

    it("should propagate error if upload fails", async () => {
      jest.spyOn(s3Instance, "upload").mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error("Upload failed")),
      } as any);
      await expect(
        service.uploadPDF(
          Buffer.from("dummy"),
          "application/pdf",
          "bucket-test",
          "filename.pdf"
        )
      ).rejects.toThrow(new Error("Upload failed"));
    });
  });
});
