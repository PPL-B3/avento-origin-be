import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Body,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { DocumentService } from "./document.service";
import { UploadDocumentDTO } from "./dto/upload-document.dto";

@Controller("documents")
export class DocumentController {
  constructor(private readonly service: DocumentService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File | null,
    @Body() body: UploadDocumentDTO
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    if (file.mimetype !== "application/pdf") {
      throw new BadRequestException("Invalid file type");
    }
    if (!body.documentName || !body.ownerName) {
      throw new BadRequestException("Missing required fields");
    }
    return this.service.uploadDocument(file, body);
  }
}
