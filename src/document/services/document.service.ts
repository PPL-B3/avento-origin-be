import { ConfigService } from "@nestjs/config";
import { DocumentRepository } from "../repositories/document.repository";
import { EmailService } from "./email.service";
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { S3StorageService } from "./s3-storage.service";
import { UploadDocumentDTO } from "../dto/upload-document.dto";
import { randomInt } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { PostHogService } from "../../posthog/posthog.service";

@Injectable()
export class DocumentService {
  constructor(
    private readonly s3Storage: S3StorageService,
    private readonly documentRepo: DocumentRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly posthogService: PostHogService,
    private readonly prisma: PrismaService
  ) {}

  async uploadDocument(pdf: Express.Multer.File, dto: UploadDocumentDTO) {
    const bucketName = this.getBucketName();
    const filename = this.generateFilename(dto, Date.now());

    await this.posthogService.captureEvent(dto.ownerName, "document_upload", {
      filename,
      ownerName: dto.ownerName,
      timestamp: Date.now(),
    });

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

    await this.posthogService.captureEvent(pendingOwner, "document_transfer", {
      documentId,
      timestamp: new Date().toISOString(),
    });

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

      await this.posthogService.captureEvent(documentId, "document_claim", {
        documentId,
        otp,
        timestamp: Date.now(),
      });

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
        document.pendingOwner,
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

  async viewDocument(qrId: string) {
    const qrCode = await this.prisma.qrCode.findUnique({
      where: { id: qrId },
      include: {
        document: {
          include: {
            qrCode: {
              orderBy: {
                generatedDate: "asc",
              },
            },
          },
        },
      },
    });

    if (!qrCode) {
      throw new NotFoundException("QR code not found");
    }

    const document = qrCode.document;
    const allQrCodes = document.qrCode;
    const activeQRCodes = allQrCodes.filter((code) => code.isActive);

    if (activeQRCodes.length === 0) {
      throw new NotFoundException("No active QR code found for this document");
    }
    if (activeQRCodes.length > 2) {
      throw new Error("Multiple active QR codes found for this document");
    }

    // Assume both active QR codes have the same owner.
    const currentOwner = activeQRCodes[0].owner;

    // Build ownership history from all QR codes.
    const ownershipMap = new Map<
      string,
      { owner: string; generatedDate: Date }
    >();

    for (const code of allQrCodes) {
      const key = code.generatedDate.toISOString();
      if (!ownershipMap.has(key)) {
        ownershipMap.set(key, {
          owner: code.owner,
          generatedDate: code.generatedDate,
        });
      }
    }

    // Convert the map to an array sorted by generatedDate ascending.
    const ownershipHistory = Array.from(ownershipMap.values()).sort(
      (a, b) => a.generatedDate.getTime() - b.generatedDate.getTime()
    );

    const response: any = {
      documentId: document.documentID,
      documentName: document.documentName,
      uploadDate: document.uploadDate,
      publisher: document.publisher,
      currentOwner,
      ownershipHistory,
    };

    // Include filePath only if the requested QR code is private.
    if (qrCode.isPrivate) {
      response.filePath = document.filePath;
    }

    return response;
  }
}
