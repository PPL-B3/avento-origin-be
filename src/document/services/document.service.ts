import { ConfigService } from "@nestjs/config";
import { DocumentRepository } from "../repositories/document.repository";
import { EmailService } from "./email.service";
import { Injectable, BadRequestException } from "@nestjs/common";
import { S3StorageService } from "./s3-storage.service";
import { UploadDocumentDTO } from "../dto/upload-document.dto";
import { randomInt } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DocumentService {
  constructor(
    private readonly s3Storage: S3StorageService,
    private readonly documentRepo: DocumentRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async uploadDocument(pdf: Express.Multer.File, dto: UploadDocumentDTO) {
    const bucketName = this.getBucketName();
    const filename = this.generateFilename(dto, Date.now());

    const url = await this.s3Storage.uploadPDF(
      pdf.buffer,
      pdf.mimetype,
      bucketName,
      filename
    );

    return this.documentRepo.createDocument({
      documentName: dto.documentName,
      filePath: url,
      uploadDate: new Date(),
      publisher: dto.ownerName,
    });
  }

  async transferDocument(documentId: string, pendingOwner: string) {
    const document = await this.documentRepo.findDocumentById(documentId);
    const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");

    await this.documentRepo.updateDocument(documentId, {
      pendingOwner: pendingOwner,
      otp,
      otpExpiry: new Date(Date.now() + 8 * 60 * 1000), // 8 minutes.
      otpAttemptCount: 0,
    });

    await this.emailService.sendOwnershipTransferEmail(
      pendingOwner,
      document.documentName,
      this.getCurrentOwner(document),
      document.publisher,
      documentId
    );

    return { otp: otp };
  }

  async claimDocument(documentId: string, otp: string) {
    return await this.prisma.$transaction(async (transaction) => {
      const document = await this.documentRepo.findDocumentById(documentId);

      if (!document.pendingOwner)
        throw new BadRequestException("No pending transfer.");
      if (new Date() > document.otpExpiry!)
        throw new BadRequestException("OTP expired.");
      if (document.otpAttemptCount >= 4)
        throw new BadRequestException("Too many failed attempts.");
      if (document.otp?.toLowerCase() !== otp.toLowerCase())
        await this.handleIncorrectOTP(documentId);

      const qrCodeIds = await this.documentRepo.changeOwnership(
        transaction,
        document.pendingOwner!,
        documentId
      );

      const updateData = {
        pendingOwner: null,
        otp: null,
        otpExpiry: null,
        otpAttemptCount: 0,
      };

      await this.documentRepo.updateDocument(
        documentId,
        updateData,
        transaction
      );

      return qrCodeIds;
    });
  }

  private getBucketName(): string {
    const bucketName = this.configService.get<string>("DO_SPACES_BUCKET");
    if (!bucketName) throw new Error("DO_SPACES_BUCKET is not configured");
    return bucketName;
  }

  private generateFilename(dto: UploadDocumentDTO, timestamp: number): string {
    const sanitize = (str: string) => str.replace(/\s+/g, "-");
    return `${sanitize(dto.ownerName)}_${sanitize(dto.documentName)}_${timestamp}.pdf`;
  }

  private getCurrentOwner(document) {
    const activeQrCodes = document.qrCode.slice(-2);
    const currentOwner = activeQrCodes.find((qr) => !qr.isPrivate)!.owner;

    return currentOwner;
  }

  private async handleIncorrectOTP(documentId: string) {
    await this.documentRepo.updateDocument(documentId, {
      otpAttemptCount: { increment: 1 },
    });
    throw new BadRequestException("Incorrect OTP.");
  }
}
