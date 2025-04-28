import { Test, TestingModule } from "@nestjs/testing";
import { DocumentController } from "./document.controller";
import { DocumentService } from "../services/document.service";
import * as request from "supertest";
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  NotFoundException,
  ValidationPipe,
} from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import * as path from "path";
import * as fs from "fs";
import { ReverseOwnershipDTO } from "../dto/reverse-ownership.dto";
import { JwtService } from "../../auth/jwt/jwt.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import { JwtAuthMiddleware } from "../../auth/jwt/middleware/jwt-auth.middleware";
import { RolesGuard } from "../../auth/roles.guard";

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
    uploadDocument: jest.fn().mockResolvedValue({
      privateId: "dummy-private-id",
      publicId: "dummy-public-id",
    }),
    requestQrCodeOTP: jest.fn(),
    transferDocument: jest.fn(),
    claimDocument: jest.fn(),
    viewDocument: jest.fn(),
    validateQrCodeOTP: jest.fn(),
    reverseOwnership: jest.fn(),
  };

  // beforeEach(() => {
  //   jest.spyOn(docService, "uploadDocument").mockResolvedValue({
  //     privateId: "dummy-private-id",
  //     publicId: "dummy-public-id",
  //   });
  // });
  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [MulterModule.register({})],
      controllers: [DocumentController],
      providers: [
        { provide: DocumentService, useValue: mockDocService },
        JwtService,
        PrismaService,
        ConfigService,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalGuards(new MockAuthGuard());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    await app.init();

    controller = moduleRef.get<DocumentController>(DocumentController);
    docService = moduleRef.get<DocumentService>(DocumentService);
  });

  afterEach(() => jest.clearAllMocks());
  afterAll(async () => await app.close());

  describe("/documents/upload (POST)", () => {
    const jwtToken = "Bearer mocked-jwt-token";

    it("should upload a valid PDF file under 8MB", async () => {
      const pathToDummyPDF = path.resolve(
        process.cwd(),
        "src",
        "document",
        "dummy.pdf"
      );

      console.log("pathToDummyPDF:", pathToDummyPDF);
      console.log("File exists?", fs.existsSync(pathToDummyPDF));

      const res = await request(app.getHttpServer())
        .post("/documents/upload")
        .attach("file", pathToDummyPDF)
        .field("documentName", "My Doc");

      expect(res.status).toBe(201);
      expect(docService.uploadDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldname: "file",
          originalname: "dummy.pdf",
          mimetype: "application/pdf",
        }),
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

  describe("/documents/access (POST)", () => {
    it("should validate OTP successfully", async () => {
      mockDocService.validateQrCodeOTP = jest
        .fn()
        .mockResolvedValue({ valid: true });

      const res = await request(app.getHttpServer())
        .post("/documents/access")
        .send({ qrId: "123e4567-e89b-12d3-a456-426614174000", otp: "654321" });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ valid: true });
      expect(docService.validateQrCodeOTP).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000",
        "654321"
      );
    });

    it("should return 400 if fields are missing", async () => {
      const res = await request(app.getHttpServer())
        .post("/documents/access")
        .send({});

      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining("qrId should not be empty"),
          expect.stringContaining("otp should not be empty"),
        ])
      );
    });
  });

  describe("/documents/reverse (POST)", () => {
    const reverseDTO: ReverseOwnershipDTO = {
      documentId: "doc-test-id",
      index: 1,
    };

    it("should call docService.reverseOwnership and return 201 on success", async () => {
      mockDocService.reverseOwnership.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .post("/documents/reverse")
        .send(reverseDTO);

      expect(res.status).toBe(201);
      expect(mockDocService.reverseOwnership).toHaveBeenCalledWith(
        reverseDTO.documentId,
        reverseDTO.index
      );
    });

    it("should forward BadRequestException from service", async () => {
      const error = new BadRequestException("Index out of range.");
      mockDocService.reverseOwnership.mockRejectedValue(error);

      const res = await request(app.getHttpServer())
        .post("/documents/reverse")
        .send(reverseDTO);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Index out of range.");
    });

    it("should return 500 if service throws unexpected error", async () => {
      mockDocService.reverseOwnership.mockRejectedValue(
        new Error("Unexpected DB error")
      );

      const res = await request(app.getHttpServer())
        .post("/documents/reverse")
        .send(reverseDTO);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Internal server error");
    });

    it("should return 400 for invalid DTO (e.g., missing index)", async () => {
      const invalidDto = { documentId: "doc-test-id" };
      const res = await request(app.getHttpServer())
        .post("/documents/reverse")
        .send(invalidDto);
      expect(res.status).toBe(400);
      expect(mockDocService.reverseOwnership).not.toHaveBeenCalled();
    });
  });

  describe("/documents/get-document/:documentId (GET)", () => {
    let app: INestApplication;
    let mockDocService: Partial<Record<keyof DocumentService, jest.Mock>>;

    beforeAll(async () => {
      mockDocService = {
        getDocument: jest.fn(),
      };

      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [MulterModule.register({})],
        controllers: [DocumentController],
        providers: [{ provide: DocumentService, useValue: mockDocService }],
      })
        // stub out both guards so they never run
        .overrideGuard(JwtAuthMiddleware)
        .useValue({ canActivate: () => true })
        .overrideGuard(RolesGuard)
        .useValue({ canActivate: () => true })
        .compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("200 + payload when document is found", async () => {
      const payload = {
        documentId: "doc-1",
        documentName: "Name",
        uploadDate: "2025-04-28T00:00:00.000Z",
        publisher: "x",
        currentOwner: "y",
        ownershipHistory: [],
        filePath: "/f.pdf",
      };
      mockDocService.getDocument!.mockResolvedValue(payload);

      const res = await request(app.getHttpServer())
        .get("/documents/get-document/123e4567-e89b-12d3-a456-426614174000");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(payload);
      expect(mockDocService.getDocument).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000"
      );
    });

    it("400 on invalid UUID", async () => {
      const res = await request(app.getHttpServer())
        .get("/documents/get-document/not-a-uuid");

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Validation failed");
      expect(mockDocService.getDocument).not.toHaveBeenCalled();
    });

    it("404 when service throws NotFoundException", async () => {
      mockDocService.getDocument!.mockRejectedValue(
        new NotFoundException("Doc not found")
      );

      const res = await request(app.getHttpServer())
        .get("/documents/get-document/123e4567-e89b-12d3-a456-426614174000");

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Doc not found");
    });

    it("500 when service throws generic error", async () => {
      mockDocService.getDocument!.mockRejectedValue(new Error("oops"));

      const res = await request(app.getHttpServer())
        .get("/documents/get-document/123e4567-e89b-12d3-a456-426614174000");

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Internal server error");
    });
  });
});
