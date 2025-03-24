import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { DocumentService } from "./document.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { UploadDocumentDTO } from "./dto/upload-document.dto";
import { QrcodeService } from "../qrcode/qrcode.service";

@Controller("documents")
export class DocumentController {
  private readonly MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB.

  constructor(
    private readonly docService: DocumentService,
    private readonly qrService: QrcodeService
  ) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File | null,
    @Body() body: UploadDocumentDTO
  ) {
    if (!file) throw new BadRequestException("No file uploaded.");
    if (file.mimetype !== "application/pdf") {
      throw new BadRequestException("Invalid file type.");
    }
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException("File size exceeds 8MB limit.");
    }
    if (!body.documentName || !body.ownerName) {
      throw new BadRequestException("Missing required fields.");
    }

    try {
      const doc = await this.docService.uploadDocument(file, body);
      return await this.qrService.generateQr(doc.documentID, body.ownerName);
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  @Post("transfer")
  async transferDocument(@Body() body: { documentId: string; email: string }) {
    if (!body.documentId || !body.email) {
      throw new BadRequestException("Missing documentId or email.");
    }

    return await this.docService.transferDocument(body.documentId, body.email);
  }
}
