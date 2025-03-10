import * as request from "supertest";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";

describe("Document Upload (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should upload valid PDF", () => {
    return request(app.getHttpServer())
      .post("/documents/upload")
      .field("documentName", "test")
      .field("ownerName", "user")
      .attach("file", Buffer.from("test"), "test.pdf")
      .expect(201);
  });

  it("should reject invalid file type", () => {
    return request(app.getHttpServer())
      .post("/documents/upload")
      .field("documentName", "test")
      .field("ownerName", "user")
      .attach("file", Buffer.from("test"), "test.txt")
      .expect(400);
  });
});
