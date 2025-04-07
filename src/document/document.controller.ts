import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { DocumentService } from "./document.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { UploadDocumentDTO } from "./dto/upload-document.dto";
import { QrcodeService } from "../qrcode/qrcode.service";
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";

@Controller("documents")
export class DocumentController {
  private readonly MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB.

  constructor(
    private readonly service: DocumentService,
    private readonly qrService: QrcodeService,
    private readonly prismaService: PrismaService,
  ) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Upload a PDF document and generate QR codes" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    description: "Upload a PDF file with document metadata",
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
        documentName: {
          type: "string",
          example: "Project Proposal",
        },
        ownerName: {
          type: "string",
          example: "Alice Johnson",
        },
      },
      required: ["file", "documentName", "ownerName"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "QR code IDs generated successfully",
    schema: {
      type: "object",
      properties: {
        privateId: { type: "string", example: "private_qr_id" },
        publicId: { type: "string", example: "public_qr_id" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad Request: Missing file, invalid file type, file too large, or missing required fields",
  })
  @ApiResponse({ status: 500, description: "Internal Server Error" })
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

  @Get("view/:qrId")
  async viewDocument(@Param("qrId", new ParseUUIDPipe()) qrId: string) {
    return await this.service.viewDocument(qrId);
  }
}
