import { S3StorageService } from "./s3-storage.service";
import { ConfigService } from "@nestjs/config";
import * as AWS from "aws-sdk";

describe("S3StorageService", () => {
  let service: S3StorageService;
  let configService: Partial<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case "DO_SPACES_ENDPOINT":
            return "https://do.spaces.endpoint";
          case "DO_SPACES_KEY":
            return "dummy-key";
          case "DO_SPACES_SECRET":
            return "dummy-secret";
          case "DO_SPACES_REGION":
            return "dummy-region";
          default:
            return null;
        }
      }),
    };

    // By default, mock AWS.S3 to simulate a successful upload returning a Location.
    jest.spyOn(AWS, "S3").mockImplementation(
      () =>
        ({
          upload: (_params: AWS.S3.PutObjectRequest) => ({
            promise: () =>
              Promise.resolve({
                Location: "https://bucket.endpoint/filename.pdf",
              }),
          }),
        }) as any
    );

    service = new S3StorageService(configService as ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("uploadPDF", () => {
    it("should upload and return the location URL", async () => {
      const buffer = Buffer.from("pdf data");
      const mimetype = "application/pdf";
      const bucketName = "bucket";
      const filename = "filename.pdf";

      const location = await service.uploadPDF(
        buffer,
        mimetype,
        bucketName,
        filename
      );
      expect(location).toBe("https://bucket.endpoint/filename.pdf");
    });

    it("should propagate error if upload fails", async () => {
      // Override AWS.S3 to simulate a failure.
      jest.spyOn(service["s3"], "upload").mockImplementationOnce(
        () =>
          ({
            promise: () => Promise.reject(new Error("Upload failed")),
          }) as any
      );

      await expect(
        service.uploadPDF(
          Buffer.from("pdf"),
          "application/pdf",
          "bucket",
          "filename.pdf",
        ),
      ).rejects.toThrow("Upload failed");
    });

    it("should call s3.upload with correct parameters", async () => {
      const buffer = Buffer.from("sample data");
      const mimetype = "application/pdf";
      const bucketName = "test-bucket";
      const filename = "test-file.pdf";

      // Spy on the upload method to capture its parameters.
      const uploadSpy = jest.spyOn(service["s3"], "upload").mockReturnValue({
        promise: () =>
          Promise.resolve({
            Location: "url",
            ETag: "asd",
            Bucket: bucketName,
            Key: filename,
          }),
        abort: jest.fn(),
        send: jest.fn(),
        on: jest.fn(),
      });
      jest.spyOn(AWS, "S3").mockImplementationOnce(
        () =>
          ({
            upload: uploadSpy,
          }) as any
      );

      await service.uploadPDF(buffer, mimetype, bucketName, filename);
      expect(uploadSpy).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: filename,
        Body: buffer,
        ContentType: mimetype,
      });
    });
  });
});
