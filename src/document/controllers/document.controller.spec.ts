import { Test, TestingModule } from "@nestjs/testing";
import { DocumentController } from "./document.controller";
import { DocumentService } from "../services/document.service";
import * as request from "supertest";
import { INestApplication } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";

describe("DocumentController", () => {
  let app: INestApplication;
  let docService: DocumentService;

  const mockDocService = {
    uploadDocument: jest.fn(),
    transferDocument: jest.fn(),
    claimDocument: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [MulterModule.register({})],
      controllers: [DocumentController],
      providers: [{ provide: DocumentService, useValue: mockDocService }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    docService = moduleRef.get<DocumentService>(DocumentService);
  });

  afterEach(() => jest.clearAllMocks());
  afterAll(async () => await app.close());

  describe("/documents/upload (POST)", () => {
    it("should upload a valid PDF file under 8MB", async () => {
      mockDocService.uploadDocument.mockResolvedValue({ success: true });

      const res = await request(app.getHttpServer())
        .post("/documents/upload")
        .attach("file", Buffer.from("%PDF-1.4"), "document.pdf")
        .field("title", "My Doc")
        .set("Content-Type", "multipart/form-data");

      expect(res.status).toBe(201);
      expect(docService.uploadDocument).toHaveBeenCalled();
    });

    it("should reject when no file is uploaded", async () => {
      const res = await request(app.getHttpServer())
        .post("/documents/upload")
        .field("title", "No File");

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("No file uploaded.");
    });

    it("should reject non-PDF files", async () => {
      const res = await request(app.getHttpServer())
        .post("/documents/upload")
        .attach("file", Buffer.from("not-a-pdf"), "image.jpg")
        .field("title", "Wrong File");

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid file type.");
    });

    it("should reject PDFs larger than 8MB", async () => {
      const bigBuffer = Buffer.alloc(8 * 1024 * 1024 + 1, ".");

      const res = await request(app.getHttpServer())
        .post("/documents/upload")
        .attach("file", bigBuffer, "big.pdf")
        .field("title", "Too Big");

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
});
