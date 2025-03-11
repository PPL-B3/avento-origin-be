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

@Controller("documents")
export class DocumentController {
  constructor(private readonly service: DocumentService) {}

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
    if (!body.documentName || !body.ownerName) {
      throw new BadRequestException("Missing required fields.");
    }

    try {
      const response = await this.service.uploadDocument(file, body);
      const { message, ...rest } = response;

      return { message: "Document uploaded successfully.", ...rest };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
