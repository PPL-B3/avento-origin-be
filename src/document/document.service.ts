import * as AWS from "aws-sdk";
import { ConfigService } from "@nestjs/config";
import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PutObjectRequest } from "aws-sdk/clients/s3";
import { UploadDocumentDTO } from "./dto/upload-document.dto";
import { randomInt } from "crypto";
import * as nodemailer from "nodemailer";

@Injectable()
export class DocumentService {
  private readonly bucket: AWS.S3;
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    this.bucket = new AWS.S3({
      endpoint: configService.get<string>("DO_SPACES_ENDPOINT"),
      accessKeyId: configService.get<string>("DO_SPACES_KEY"),
      secretAccessKey: configService.get<string>("DO_SPACES_SECRET"),
      region: configService.get<string>("DO_SPACES_REGION"),
    });
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: configService.get<string>("GMAIL_USER"),
        pass: configService.get<string>("GMAIL_PASS"),
      },
    });
  }

  async uploadToBucket(
    pdf: Express.Multer.File,
    body: UploadDocumentDTO,
    timestamp: number
  ): Promise<string> {
    const bucketName = this.configService.get<string>("DO_SPACES_BUCKET");
    if (!bucketName) {
      throw new Error("DO_SPACES_BUCKET environment variable is not defined.");
    }

    const sanitizedOwnerName = body.ownerName.replace(/\s+/g, "-");
    const sanitizedDocName = body.documentName.replace(/\s+/g, "-");
    const filename = `${sanitizedOwnerName}_${sanitizedDocName}_${timestamp}.pdf`;

    const params: PutObjectRequest = {
      Bucket: bucketName,
      Key: filename,
      Body: pdf.buffer,
      ContentType: pdf.mimetype,
    };

    const { Location } = await this.bucket.upload(params).promise();
    return Location;
  }

  async uploadDocument(pdf: Express.Multer.File, body: UploadDocumentDTO) {
    const timestamp = Date.now();
    const url = await this.uploadToBucket(pdf, body, timestamp);

    return await this.prisma.document.create({
      data: {
        documentName: body.documentName,
        filePath: url,
        uploadDate: new Date(timestamp),
        publisher: body.ownerName,
      },
    });
  }

  async transferDocument(documentId: string, email: string) {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw new BadRequestException("Invalid email format.");
    }

    // Ambil dokumen beserta QRCode-nya.
    const document = await this.prisma.document.findUnique({
      where: { documentID: documentId },
      include: { qrCode: true },
    });

    if (!document) {
      throw new BadRequestException("Document not found.");
    }

    // Ambil QRCode publik pertama.
    const publicQr = document.qrCode.find((qr) => qr.isPrivate === false);
    const ownerForEmail = publicQr ? publicQr.owner : document.publisher;

    const otp = randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 8 * 60 * 1000);

    await this.prisma.document.update({
      where: { documentID: documentId },
      data: {
        pendingOwner: email,
        otp,
        otpExpiry,
        otpAttemptCount: 0,
      },
    });

    // Kirim email ke address yang diberikan.
    const subject = "Permintaan Pengalihan Kepemilikan Dokumen";
    const sampleUrl = "https://sample-url.com";
    const htmlContent = `
      <p>${ownerForEmail} telah meminta untuk mengambil kepemilikan PDF bernama ${document.documentName} yang dipublikasikan oleh ${document.publisher}.</p>
      <p>Silakan klik <a href="${sampleUrl}">tautan ini</a> dan minta ${ownerForEmail} untuk memberikan OTP.</p>
    `;

    try {
      await this.transporter.sendMail({
        from: `"Avento" <${this.configService.get<string>("GMAIL_USER")}>`,
        to: email,
        subject,
        html: htmlContent,
      });
    } catch (error) {
      throw new BadRequestException("Gagal mengirim email: " + error.message);
    }

    return { otp };
  }
}
