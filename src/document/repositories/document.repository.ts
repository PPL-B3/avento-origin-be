import { Document, Prisma } from "@prisma/client";
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DocumentRepository {
  constructor(private prisma: PrismaService) {}

  async createDocument(data: Prisma.DocumentCreateInput) {
    return this.prisma.$transaction(async (transaction) => {
      const document = await transaction.document.create({ data });

      return await this.generateAndAttachQrCodes(
        transaction,
        data.publisher,
        document.documentID,
      );
    });
  }

  async changeOwnership(
    transaction: Prisma.TransactionClient,
    pendingOwner: string,
    documentId: string,
  ) {
    const document = await this.findDocumentById(documentId, transaction);

    const activeQrCodes = document.qrCode.slice(-2);
    await Promise.all(
      activeQrCodes.map((qr) =>
        transaction.qrCode.update({
          where: { id: qr.id },
          data: { isActive: false },
        }),
      ),
    );

    return await this.generateAndAttachQrCodes(
      transaction,
      pendingOwner,
      documentId,
    );
  }

  private async generateAndAttachQrCodes(
    transactions: Prisma.TransactionClient,
    owner: string,
    documentId: string,
  ): Promise<{ privateId: string; publicId: string }> {
    const qrCodeBatch = this.createQrCodeBatch(owner, documentId);

    const qrCodes = await Promise.all(
      qrCodeBatch.map((qr) => transactions.qrCode.create({ data: qr })),
    );

    const privateQr = qrCodes.find((qr) => qr.isPrivate);
    const publicQr = qrCodes.find((qr) => !qr.isPrivate);
    if (!privateQr || !publicQr)
      throw new Error("Failed creating private and/or public QR codes.");

    await transactions.document.update({
      where: { documentID: documentId },
      data: {
        qrCode: { connect: qrCodes.map((qr) => ({ id: qr.id })) },
      },
    });

    return {
      privateId: privateQr.id,
      publicId: publicQr.id,
    };
  }

  async findDocumentById(
    documentId: string,
    transaction: Prisma.TransactionClient = this.prisma,
  ) {
    const document = await transaction.document.findUnique({
      where: { documentID: documentId },
      include: {
        qrCode: {
          orderBy: {
            generatedDate: "asc",
          },
        },
      },
    });
    if (!document) throw new BadRequestException("Document not found.");
    return document;
  }

  async updateDocument(
    documentId: string,
    data: Prisma.DocumentUpdateInput,
    transaction: Prisma.TransactionClient = this.prisma,
  ): Promise<Document> {
    return transaction.document.update({
      where: { documentID: documentId },
      data,
    });
  }

  private createQrCodeBatch(owner: string, documentId: string) {
    const now = new Date();
    const base = { owner, isActive: true, generatedDate: now, documentId };

    return [false, true].map((isPrivate) => ({ ...base, isPrivate }));
  }
}
