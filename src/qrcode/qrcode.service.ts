import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class QrcodeService {
  constructor(private readonly prismaService: PrismaService) {}

  async generateQr(documentId: string, ownerName: string) {
    const document = await this.prismaService.document.findUnique({
      where: { documentID: documentId },
    });

    if (!document) {
      throw new BadRequestException("Document not found.");
    }

    const privateQr = await this.prismaService.qrCode.create({
      data: {
        documentId,
        owner: ownerName,
        isPrivate: true,
        isActive: true,
      },
      select: {
        id: true,
      },
    });
    const publicQr = await this.prismaService.qrCode.create({
      data: {
        documentId,
        owner: ownerName,
        isPrivate: false,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    await this.prismaService.document.update({
      where: { documentID: documentId },
      data: {
        qrCode: {
          connect: [{ id: privateQr.id }, { id: publicQr.id }],
        },
      },
    });

    return { privateId: privateQr.id, publicId: publicQr.id };
  }
}
