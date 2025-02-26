import { Injectable } from "@nestjs/common";

@Injectable()
export class DocumentService {
  async uploadDocument(file: Express.Multer.File, body: any) {
    return { message: "Document uploaded successfully" };
  }
}
