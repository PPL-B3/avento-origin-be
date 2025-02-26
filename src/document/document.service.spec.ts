import { DocumentService } from "./document.service";

describe("DocumentService", () => {
  let service: DocumentService;

  beforeEach(() => {
    service = new DocumentService();
  });

  it("should upload document successfully", async () => {
    const file = {} as Express.Multer.File;
    const body = { documentName: "Test Document", ownerName: "Test Owner" };
    const result = await service.uploadDocument(file, body);
    expect(result).toEqual({ message: "Document uploaded successfully" });
  });
});
