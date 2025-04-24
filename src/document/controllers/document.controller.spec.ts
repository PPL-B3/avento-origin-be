import { Test, TestingModule } from "@nestjs/testing";
import { DocumentController } from "./document.controller";
import { DocumentService } from "../services/document.service";
import * as request from "supertest";
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";

@Injectable()
class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = { userId: "test-user" };
    return true;
  }
}

describe("DocumentController", () => {
  let app: INestApplication;
  let docService: DocumentService;
  let controller: DocumentController;

  const mockDocService = {
    uploadDocument: jest.fn(),
    requestQrCodeOTP: jest.fn(),
    transferDocument: jest.fn(),
    claimDocument: jest.fn(),
    viewDocument: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [MulterModule.register({})],
      controllers: [DocumentController],
      providers: [{ provide: DocumentService, useValue: mockDocService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalGuards(new MockAuthGuard());
    await app.init();

    controller = moduleRef.get<DocumentController>(DocumentController);
    docService = moduleRef.get<DocumentService>(DocumentService);
  });

  afterEach(() => jest.clearAllMocks());
  afterAll(async () => await app.close());

  describe("/documents/upload (POST)", () => {
    const jwtToken = "Bearer mocked-jwt-token";

    it("should upload a valid PDF file under 8MB", async () => {
      mockDocService.uploadDocument.mockResolvedValue({
        privateId: "p",
        publicId: "q",
      });

      const res = await request(app.getHttpServer())
        .post("/documents/upload")
        .set("Authorization", jwtToken)
        .attach("file", Buffer.from("%PDF-1.4"), "document.pdf")
        .field("documentName", "My Doc")
        .set("Content-Type", "multipart/form-data");

      expect(res.status).toBe(201);
      expect(docService.uploadDocument).toHaveBeenCalledWith(
        expect.any(Object),
        { documentName: "My Doc" },
        "test-user"
      );
    });

    it("should reject when no file is uploaded", async () => {
      const res = await request(app.getHttpServer())
        .post("/documents/upload")
        .set("Authorization", jwtToken)
        .field("documentName", "No File");

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("No file uploaded.");
    });

    it("should reject non-PDF files", async () => {
      const res = await request(app.getHttpServer())
        .post("/documents/upload")
        .set("Authorization", jwtToken)
        .attach("file", Buffer.from("not-a-pdf"), "image.jpg")
        .field("documentName", "Wrong File");

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid file type.");
    });

    it("should reject PDFs larger than 8MB", async () => {
      const bigBuffer = Buffer.alloc(8 * 1024 * 1024 + 1, ".");

      const res = await request(app.getHttpServer())
        .post("/documents/upload")
        .set("Authorization", jwtToken)
        .attach("file", bigBuffer, "big.pdf")
        .field("documentName", "Too Big");

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("File size exceeds 8MB limit.");
    });
  });

  describe("/documents/transfer (POST)", () => {
    it("should transfer a document when given valid input", async () => {
      mockDocService.transferDocument.mockResolvedValue({ transferred: true });

      const res = await request(app.getHttpServer())
        .post("/documents/transfer")
        .send({
          documentId: "abc123",
          pendingOwner: "newowner@example.com",
        });

      expect(res.status).toBe(201);
      expect(docService.transferDocument).toHaveBeenCalledWith(
        "abc123",
        "newowner@example.com"
      );
    });

    // it("should return 400 for missing fields in transfer request", async () => {
    //   const res = await request(app.getHttpServer())
    //     .post("/documents/transfer")
    //     .send({});

    //   expect(res.status).toBe(400);
    // });
  });

  describe("/documents/claim (POST)", () => {
    it("should claim a document with valid OTP", async () => {
      mockDocService.claimDocument.mockResolvedValue({ claimed: true });

      const res = await request(app.getHttpServer())
        .post("/documents/claim")
        .send({ documentId: "doc123", otp: "123456" });

      expect(res.status).toBe(201);
      expect(docService.claimDocument).toHaveBeenCalledWith("doc123", "123456");
    });

    // it("should return 400 if fields are missing in claim", async () => {
    //   const res = await request(app.getHttpServer())
    //     .post("/documents/claim")
    //     .send({ documentId: "doc123" });

    //   expect(res.status).toBe(400);
    // });
  });

  describe("/documents/view/:qrId (GET)", () => {
    it("should return result from service (positive case)", async () => {
      const qrId = "valid-uuid";
      const expectedResult = {
        documentName: "Test Document",
        uploadDate: new Date(),
        publisher: "Test Publisher",
        ownershipHistory: [{ owner: "Owner1", generatedDate: new Date() }],
        currentOwner: "Owner1",
        filePath: "/test/path.pdf",
      };
      jest.spyOn(docService, "viewDocument").mockResolvedValue(expectedResult);

      const result = await controller.viewDocument(qrId);
      expect(result).toEqual(expectedResult);
    });

    it("should throw NotFoundException when the service throws one", async () => {
      const qrId = "valid-uuid";
      jest
        .spyOn(docService, "viewDocument")
        .mockRejectedValue(new NotFoundException("QR code not found"));
      await expect(controller.viewDocument(qrId)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("/documents/test-error (GET)", () => {
    it("should throw an error and return a 500 status", async () => {
      const res = await request(app.getHttpServer()).get(
        "/documents/test-error"
      );

      // Expect the error handler to catch the error and return 500
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Internal server error");
    });
  });

  describe("/documents/access/:qrId (GET)", () => {
    const validQrId = "123e4567-e89b-12d3-a456-426614174000"; // valid UUID format

    it("should request OTP successfully", async () => {
      const mockResponse = { owner: "owner@example.com", document: "Test Doc" };
      mockDocService.requestQrCodeOTP.mockResolvedValue(mockResponse);

      const res = await request(app.getHttpServer()).get(
        `/documents/access/${validQrId}`
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResponse);
      expect(docService.requestQrCodeOTP).toHaveBeenCalledWith(validQrId);
    });

    it("should return 400 if qrId is not a valid UUID", async () => {
      const invalidQrId = "invalid-uuid";

      const res = await request(app.getHttpServer()).get(
        `/documents/access/${invalidQrId}`
      );

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        "Validation failed (uuid is expected)"
      );
    });

    it("should return appropriate error if service throws", async () => {
      mockDocService.requestQrCodeOTP.mockRejectedValue(
        new NotFoundException("QR Code not found")
      );

      const res = await request(app.getHttpServer()).get(
        `/documents/access/${validQrId}`
      );

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("QR Code not found");
    });
  });
});
