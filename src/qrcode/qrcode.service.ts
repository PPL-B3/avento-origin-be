import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class QrcodeService {
  constructor(private readonly prismaService: PrismaService) {}

  async generateQr(documentId: string, ownerName: string) {
    let document;
    try {
      document = await this.prismaService.document.findUniqueOrThrow({
        where: { documentID: documentId },
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError) {
        if (err.code === "P2025") {
          throw new BadRequestException("No document found with such ID");
        }
      }
      throw err;
    }

    const privateQr = await this.prismaService.qRCode.create({
      data: {
        documentId,
        owner: ownerName,
        isPrivate: true,
        isActive: true,
        ownerNumber: document.ownerCount + 1,
      },
      select: {
        id: true,
      },
    });

    const publicQr = await this.prismaService.qRCode.create({
      data: {
        documentId,
        owner: ownerName,
        isPrivate: false,
        isActive: true,
        ownerNumber: document.ownerCount + 1,
      },
      select: {
        id: true,
      },
    });

    await this.prismaService.document.update({
      where: {
        documentID: documentId,
      },
      data: {
        ownerCount: {
          increment: 1,
        },
      },
    });

    return {
      privateId: privateQr.id,
      publicId: publicQr.id,
    };
  }
}
