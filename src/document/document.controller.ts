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

@Controller("documents")
export class DocumentController {
  constructor(private readonly service: DocumentService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File | null,
    @Body() body: { documentName: string; ownerName: string }
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
