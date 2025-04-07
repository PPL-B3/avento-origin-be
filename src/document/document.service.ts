import * as AWS from "aws-sdk";
import { ConfigService } from "@nestjs/config";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PutObjectRequest } from "aws-sdk/clients/s3";
import { UploadDocumentDTO } from "./dto/upload-document.dto";

@Injectable()
export class DocumentService {
  private readonly bucket: AWS.S3;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
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
    timestamp: number,
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
        ownerCount: 1,
      },
    });
  }

  async viewDocument(qrId: string) {
    // Fetch the QR code and its associated document using the provided qrId.
    const qrCode = await this.prisma.qRCode.findUnique({
      where: { id: qrId },
      include: { document: true },
    });

    if (!qrCode) {
      throw new NotFoundException("QR code not found");
    }

    // Retrieve all QR codes associated with the same document.
    const relatedQRCodes = await this.prisma.qRCode.findMany({
      where: { documentId: qrCode.documentId },
    });

    // Group QR codes by ownerNumber.
    const ownershipMap = new Map<
      number,
      { owner: string; generatedDate: Date }
    >();
    for (const code of relatedQRCodes) {
      // If we haven't seen this ownerNumber yet, add it.
      if (!ownershipMap.has(code.ownerNumber)) {
        ownershipMap.set(code.ownerNumber, {
          owner: code.owner,
          generatedDate: code.generatedDate,
        });
      }
    }

    // Convert the map to an array, sorting by ownerNumber to preserve the ownership order.
    const ownershipHistory = Array.from(ownershipMap.entries())
      .sort(([ownerNumberA], [ownerNumberB]) => ownerNumberA - ownerNumberB)
      .map(([_, data]) => data);

    // Identify the current owner by finding the active QR code.
    // There can only be one active QR code per document.
    const activeQRCodes = relatedQRCodes.filter((code) => code.isActive);
    if (activeQRCodes.length === 0) {
      throw new NotFoundException("No active QR code found for this document");
    }
    if (activeQRCodes.length > 1) {
      throw new Error("Multiple active QR codes found for this document");
    }
    const currentOwner = activeQRCodes[0].owner;

    // Build the response object.
    const { document } = qrCode;
    const response: any = {
      documentName: document.documentName,
      uploadDate: document.uploadDate,
      publisher: document.publisher,
      currentOwner,
      ownershipHistory,
    };

    // If the QR code is private, include the filePath.
    if (qrCode.isPrivate) {
      response.filePath = document.filePath;
    }

    return response;
  }
}
