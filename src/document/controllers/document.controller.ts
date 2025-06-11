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
  UseGuards,
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
import { AccessQrCodeDTO } from "../dto/access-qr-code.dto";
import { ReverseOwnershipDTO } from "../dto/reverse-ownership.dto";
import { Roles } from "../../auth/roles.decorator";
import { JwtAuthMiddleware } from "../../auth/jwt/middleware/jwt-auth.middleware";
import { RolesGuard } from "../../auth/roles.guard";
import { MetricService } from "../../pushBack/metric.service";

@Controller("documents")
export class DocumentController {
  private readonly MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB.
  private readonly FILE_TYPE = "application/pdf"; // PDF.

  constructor(
    private readonly docService: DocumentService,
    private readonly metricService: MetricService,
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
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request,
    @Body() body: UploadDocumentDTO,
  ) {
    // Start timing the upload
    const startTime = Date.now();

    try {
      if (!file) {
        this.metricService.updateDocumentUploadFailureMetric();
        throw new BadRequestException("No file uploaded.");
      }
      if (file.mimetype !== this.FILE_TYPE) {
        this.metricService.updateDocumentUploadFailureMetric();
        throw new BadRequestException("Invalid file type.");
      }
      if (file.size > this.MAX_FILE_SIZE) {
        this.metricService.updateDocumentUploadFailureMetric();
        throw new BadRequestException("File size exceeds 8MB limit.");
      }

      // Track file size
      this.metricService.updateDocumentUploadSizeMetric(file.size);

      // Call the document service
      const result = await this.docService.uploadDocument(
        file,
        body,
        request["user"].userId,
      );

      // Record successful upload
      this.metricService.updateDocumentUploadMetric();

      // Calculate and record duration
      const duration = (Date.now() - startTime) / 1000; // Convert to seconds
      this.metricService.updateDocumentUploadDurationMetric(duration);

      // Push metrics to gateway
      await this.metricService.pushMetricsToGateway(
        "document_upload",
        "document_controller",
      );

      return result;
    } catch (error) {
      // Record upload failure
      this.metricService.updateDocumentUploadFailureMetric();

      // Push failure metrics to gateway
      await this.metricService.pushMetricsToGateway(
        "document_upload_failure",
        "document_controller",
      );

      throw error;
    }
  }

  @Post("transfer")
  async transferDocument(@Body() body: TransferDocumentDTO) {
    // Start timing the transfer
    const startTime = Date.now();

    try {
      const result = await this.docService.transferDocument(
        body.documentId,
        body.pendingOwner,
      );

      // Record successful transfer
      this.metricService.updateDocumentTransferMetric();

      // Calculate and record duration
      const duration = (Date.now() - startTime) / 1000; // Convert to seconds
      this.metricService.updateDocumentTransferDurationMetric(duration);

      // Push metrics to gateway
      await this.metricService.pushMetricsToGateway(
        "document_transfer",
        "document_controller",
      );

      return result;
    } catch (error) {
      // Record transfer failure
      this.metricService.updateDocumentTransferFailureMetric();

      // Push failure metrics to gateway
      await this.metricService.pushMetricsToGateway(
        "document_transfer_failure",
        "document_controller",
      );

      throw error;
    }
  }

  @Post("claim")
  async claimDocument(@Body() body: ClaimDocumentDTO) {
    return await this.docService.claimDocument(body.documentId, body.otp);
  }

  @Get("view/:qrId")
  async viewDocument(@Param("qrId", new ParseUUIDPipe()) qrId: string) {
    return await this.docService.viewDocument(qrId);
  }

  @Get("get-document/:documentId")
  @UseGuards(JwtAuthMiddleware, RolesGuard)
  @Roles("ADMIN")
  async getDocument(
    @Param("documentId", new ParseUUIDPipe()) documentId: string,
  ) {
    return this.docService.getDocument(documentId);
  }

  @Get("access/:qrId")
  async requestQrCodeOTP(@Param("qrId", new ParseUUIDPipe()) qrId: string) {
    return await this.docService.requestQrCodeOTP(qrId);
  }

  @Post("access")
  async validateQrCodeOTP(@Body() body: AccessQrCodeDTO) {
    return await this.docService.validateQrCodeOTP(body.qrId, body.otp);
  }

  @Post("reverse")
  async reverseOwnership(@Body() body: ReverseOwnershipDTO) {
    return await this.docService.reverseOwnership(body.documentId, body.index);
  }

  @Get("test-error")
  testError(): never {
    // Record error metric
    this.metricService.updateDocumentUploadFailureMetric();

    throw new Error(
      "This is a test error. Should always trigger error handler.",
    );
  }
}
