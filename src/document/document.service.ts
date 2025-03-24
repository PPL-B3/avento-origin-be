import * as AWS from "aws-sdk";
import { ConfigService } from "@nestjs/config";
import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PutObjectRequest } from "aws-sdk/clients/s3";
import { UploadDocumentDTO } from "./dto/upload-document.dto";
import { randomInt } from "crypto";

@Injectable()
export class DocumentService {
  private readonly bucket: AWS.S3;

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

    // Ensure a safe and unique filename.
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

    const document = await this.prisma.document.findUnique({
      where: { documentID: documentId },
    });

    if (!document) {
      throw new BadRequestException("Document not found.");
    }

    const otp = randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 8 * 60 * 1000); // 8 minutes.

    await this.prisma.document.update({
      where: { documentID: documentId },
      data: {
        pendingOwner: email,
        otp,
        otpExpiry,
        otpAttemptCount: 0,
      },
    });

    return { otp: otp };
  }
}
