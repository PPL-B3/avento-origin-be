import { Test, TestingModule } from "@nestjs/testing";
import { QrcodeService } from "./qrcode.service";
import { PrismaService } from "../prisma/prisma.service";
import { BadRequestException } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

describe("QrcodeService", () => {
  let qrService: QrcodeService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrcodeService,
        {
          provide: PrismaService,
          useValue: {
            document: {
              findUniqueOrThrow: jest.fn(),
            },
            qRCode: {
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    qrService = module.get<QrcodeService>(QrcodeService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it("should throw a bad request error if documentId is not found", async () => {
    const docId = "123";

    jest.spyOn(prismaService.document, "findUniqueOrThrow").mockRejectedValue(
      new PrismaClientKnownRequestError("", {
        code: "P2025",
        clientVersion: "6.5.0",
      }),
    );

    await expect(qrService.generateQr(docId)).rejects.toThrow(
      new BadRequestException("No document found with such ID"),
    );
  });

  it("should propegate error if exception code is other", async () => {
    const docId = "123";

    const err = new PrismaClientKnownRequestError("", {
      code: "P6969",
      clientVersion: "6.5.0",
    });

    jest
      .spyOn(prismaService.document, "findUniqueOrThrow")
      .mockRejectedValue(err);

    await expect(qrService.generateQr(docId)).rejects.toThrow(err);
  });

  it("should return private and public QR code IDs", async () => {
    const mockDocument = {
      documentID: "123",
      documentName: "file",
      filePath: "file.txt",
      uploadDate: new Date(Date.now()),
      ownerName: "owner",
      qrCode: [],
    };

    const privateId = "private123";
    const publicId = "public123";

    jest
      .spyOn(prismaService.document, "findUniqueOrThrow")
      .mockResolvedValue(mockDocument);

    const qrcode_create = jest.spyOn(prismaService.qRCode, "create");
    qrcode_create.mockResolvedValueOnce({ id: privateId } as any);
    qrcode_create.mockResolvedValueOnce({ id: publicId } as any);

    const result = await qrService.generateQr(mockDocument.documentID);
    expect(result).toEqual({
      privateId: privateId,
      publicId: publicId,
    });
  });
});
