import { Test, TestingModule } from "@nestjs/testing";
import { QrcodeService } from "./qrcode.service";
import { PrismaService } from "../prisma/prisma.service";
import { BadRequestException } from "@nestjs/common";

describe("QrcodeService", () => {
  let qrcodeService: QrcodeService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrcodeService,
        {
          provide: PrismaService,
          useValue: {
            document: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            qRCode: {
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    qrcodeService = module.get<QrcodeService>(QrcodeService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("harus melempar BadRequestException jika dokumen tidak ditemukan", async () => {
    (prismaService.document.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(qrcodeService.generateQr("doc1", "owner1")).rejects.toThrow(
      BadRequestException
    );
    expect(prismaService.document.findUnique).toHaveBeenCalledWith({
      where: { documentID: "doc1" },
    });
  });

  it("harus membuat QR code dan mengupdate dokumen jika dokumen ada", async () => {
    const mockDocument = { documentID: "doc1" };
    (prismaService.document.findUnique as jest.Mock).mockResolvedValue(
      mockDocument
    );
    const mockPrivateQr = { id: "private1" };
    const mockPublicQr = { id: "public1" };
    (prismaService.qrCode.create as jest.Mock)
      .mockResolvedValueOnce(mockPrivateQr)
      .mockResolvedValueOnce(mockPublicQr);
    (prismaService.document.update as jest.Mock).mockResolvedValue({});

    const result = await qrcodeService.generateQr("doc1", "owner1");

    expect(prismaService.document.findUnique).toHaveBeenCalledWith({
      where: { documentID: "doc1" },
    });
    expect(prismaService.qrCode.create).toHaveBeenNthCalledWith(1, {
      data: {
        documentId: "doc1",
        owner: "owner1",
        isPrivate: true,
        isActive: true,
      },
      select: { id: true },
    });
    expect(prismaService.qrCode.create).toHaveBeenNthCalledWith(2, {
      data: {
        documentId: "doc1",
        owner: "owner1",
        isPrivate: false,
        isActive: true,
      },
      select: { id: true },
    });
    expect(prismaService.document.update).toHaveBeenCalledWith({
      where: { documentID: "doc1" },
      data: {
        qrCode: {
          connect: [{ id: mockPrivateQr.id }, { id: mockPublicQr.id }],
        },
      },
    });
    expect(result).toEqual({
      privateId: mockPrivateQr.id,
      publicId: mockPublicQr.id,
    });
  });
});
