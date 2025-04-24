import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ClaimDocumentDTO } from "../dto/claim-document.dto";
import { DocumentService } from "../services/document.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { TransferDocumentDTO } from "../dto/transfer-document.dto";
import { UploadDocumentDTO } from "../dto/upload-document.dto";
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { Request } from "express";

@Controller("documents")
export class DocumentController {
  private readonly MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB.
  private readonly FILE_TYPE = "application/pdf"; // PDF.

  constructor(private readonly docService: DocumentService) {}

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
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request,
    @Body() body: UploadDocumentDTO,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded.");
    }
    if (file.mimetype !== this.FILE_TYPE) {
      throw new BadRequestException("Invalid file type.");
    }
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException("File size exceeds 8MB limit.");
    }

    return await this.docService.uploadDocument(
      file,
      body,
      request["user"].userId,
    );
  }

  @Post("transfer")
  async transferDocument(@Body() body: TransferDocumentDTO) {
    return await this.docService.transferDocument(
      body.documentId,
      body.pendingOwner,
    );
  }

  @Post("claim")
  async claimDocument(@Body() body: ClaimDocumentDTO) {
    return await this.docService.claimDocument(body.documentId, body.otp);
  }

  @Get("view/:qrId")
  async viewDocument(@Param("qrId", new ParseUUIDPipe()) qrId: string) {
    return await this.docService.viewDocument(qrId);
  }

  @Get("access/:qrId")
  async requestOtp(@Param("qrId", new ParseUUIDPipe()) qrId: string) {
    return await this.docService.requestQrCodeOTP(qrId);
  }

  @Get("test-error")
  testError(): never {
    throw new Error(
      "This is a test error. Should always trigger error handler.",
    );
  }
}
