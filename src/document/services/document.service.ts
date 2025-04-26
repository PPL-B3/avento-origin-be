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
import { AuditLogService } from "../../auditLog/auditLog.service";

@Injectable()
export class DocumentService {
  constructor(
    private readonly s3Storage: S3StorageService,
    private readonly documentRepo: DocumentRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly posthogService: PostHogService,
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService
  ) {}

  async uploadDocument(
    pdf: Express.Multer.File,
    dto: UploadDocumentDTO,
    userId: string
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
    });
    const bucketName = this.getBucketName();
    const filename = this.generateFilename(dto, Date.now(), user.email);

    await this.posthogService.captureEvent(user.email, "document_upload", {
      filename,
      ownerName: user.email,
      timestamp: Date.now(),
    });

    const url = await this.s3Storage.uploadPDF(
      pdf.buffer,
      pdf.mimetype,
      bucketName,
      filename
    );

    const createdDocument = await this.documentRepo.createDocument({
      documentName: dto.documentName,
      filePath: url,
      uploadDate: new Date(),
      publisher: user.email,
    });

    await this.auditLogService.addAuditLog({
      eventType: "UPLOAD_DOCUMENT",
      userID: user.id,
      details: `Document "${dto.documentName}" uploaded.`,
      documentID: createdDocument.documentId,
    });

    return {
      privateId: createdDocument.privateId,
      publicId: createdDocument.publicId,
    };
  }

  async requestQrCodeOTP(qrId: string) {
    const qrCode = await this.prisma.qrCode.findUnique({
      where: { id: qrId },
      include: { document: true },
    });

    if (!qrCode || !qrCode.isActive || !qrCode.isPrivate) {
      throw new BadRequestException("This QR code isn't for OTP requests.");
    }

    let qrOTP = await this.prisma.qrCodeOTP.findUnique({
      where: { qrCodeId: qrId },
    });

    const otp = this.generateOtp();
    const now = new Date(Date.now());
    const expiry = new Date(now.getTime() + 8 * 60 * 1000); // 8 minutes.

    if (!qrOTP) {
      qrOTP = await this.prisma.qrCodeOTP.create({
        data: {
          qrCodeId: qrId,
          otp: otp,
          expiry: expiry,
          attemptCount: 0,
          cooldown: now,
        },
      });
    } else {
      if (now < qrOTP.cooldown) {
        throw new BadRequestException(this.getRetryText(qrOTP.cooldown, now));
      } else {
        await this.prisma.qrCodeOTP.update({
          where: { qrCodeId: qrId },
          data: {
            otp: otp,
            expiry: expiry,
          },
        });
      }
    }

    await this.emailService.sendPrivateAccessEmail(
      qrCode.owner,
      otp,
      qrCode.document.documentName
    );
    return { owner: qrCode.owner, document: qrCode.document.documentName };
  }

  async validateQrCodeOTP(qrId: string, otp: string) {
    const { success, qrCode } = await this.prisma.$transaction(async (tx) => {
      const qrOTP = await tx.qrCodeOTP.findUniqueOrThrow({
        where: { qrCodeId: qrId },
        include: { qrCode: true },
      });

      const now = new Date();
      if (now < qrOTP.cooldown)
        throw new BadRequestException(this.getRetryText(qrOTP.cooldown, now));
      if (now > qrOTP.expiry)
        throw new BadRequestException("OTP expired. Please request a new one.");

      const isValid = qrOTP.otp.toLowerCase() === otp.toLowerCase();
      const updateData = isValid
        ? { attemptCount: 0, expiry: now }
        : {
            attemptCount: qrOTP.attemptCount + 1,
            ...(qrOTP.attemptCount + 1 >= 4 && {
              attemptCount: 0,
              cooldown: new Date(now.getTime() + 60 * 60 * 1000),
            }),
          };

      await tx.qrCodeOTP.update({
        where: { qrCodeId: qrId },
        data: updateData,
      });

      return { success: isValid, qrCode: qrOTP.qrCode };
    });

    if (!success) throw new BadRequestException("Invalid OTP.");
    return qrCode;
  }

  async transferDocument(documentId: string, pendingOwner: string) {
    const document = await this.documentRepo.findDocumentById(documentId);
    const otp = this.generateOtp();

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
    const user = await this.prisma.user.findUnique({
      where: { email: document.publisher },
    });
    if (user) {
      await this.auditLogService.addAuditLog({
        eventType: "TRANSFER_OWNERSHIP",
        userID: user.id,
        details: `Ownership transfer initiated for document "${document.documentName}" to ${pendingOwner}`,
        documentID: documentId,
      });
    }

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

      await this.auditLogService.addAuditLog({
        eventType: "CLAIM_DOCUMENT",
        userID: document.pendingOwner,
        details: `Document "${document.documentName}" successfully claimed.`,
        documentID: documentId,
      });

      return qrCodeIds;
    });
  }

  private getBucketName(): string {
    const bucketName = this.configService.get<string>("DO_SPACES_BUCKET");
    if (!bucketName) throw new Error("DO_SPACES_BUCKET is not configured");
    return bucketName;
  }

  private generateFilename(
    dto: UploadDocumentDTO,
    timestamp: number,
    owner: string
  ): string {
    const sanitize = (str: string) => str.replace(/\s+/g, "-");
    return `${sanitize(owner)}_${sanitize(dto.documentName)}_${timestamp}.pdf`;
  }

  private readonly generateOtp = (): string =>
    randomInt(0, 1_000_000).toString().padStart(6, "0");

  private getRetryText(cooldown: Date, now: Date): string {
    const remainingMs = cooldown.getTime() - now.getTime();
    const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
    return `Retry in ${remainingMinutes} minute(s).`;
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
    if (!qrCode.isActive) {
      throw new BadRequestException("QR code exists but is inactive");
    }

    const document = qrCode.document;
    const allQrCodes = document.qrCode;
    const activeQRCodes = allQrCodes.filter((code) => code.isActive);

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
