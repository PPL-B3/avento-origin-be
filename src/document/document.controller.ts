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
    private readonly service: DocumentService,
    private readonly qrService: QrcodeService,
  ) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File | null,
    @Body() body: UploadDocumentDTO,
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
      const doc = await this.service.uploadDocument(file, body);
      return await this.qrService.generateQr(doc.documentID, body.ownerName);
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
