import { Test, TestingModule } from "@nestjs/testing";
import { QrcodeService } from "./qrcode.service";
import { PrismaService } from "../prisma/prisma.service";
import { BadRequestException } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

describe("QrcodeService", () => {
  let qrService: QrcodeService;
  let prismaService: PrismaService;

  const privateQrMock = { id: "private123" };
  const publicQrMock = { id: "public123" };

  const mockDocument = {
    documentID: "doc123",
    documentName: "Test Document",
    filePath: "file.pdf",
    uploadDate: new Date(),
    publisher: "Test Publisher",
    ownerCount: 2,
    pendingOwner: null,
    otp: null,
    otpExpiry: null,
    otpAttemptCount: 0,
    qrCode: [],
  };

  const documentId = "doc123";
  const ownerName = "OwnerName";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrcodeService,
        {
          provide: PrismaService,
          useValue: {
            document: {
              findUniqueOrThrow: jest.fn(),
              update: jest.fn(),
            },
            qRCode: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    qrService = module.get<QrcodeService>(QrcodeService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should throw a bad request error if documentId is not found", async () => {
    const docId = "123";
    const owner = "owner";

    jest.spyOn(prismaService.document, "findUniqueOrThrow").mockRejectedValue(
      new PrismaClientKnownRequestError("", {
        code: "P2025",
        clientVersion: "6.5.0",
      }),
    );

    await expect(qrService.generateQr(docId, owner)).rejects.toThrow(
      new BadRequestException("No document found with such ID"),
    );
  });

  it("should propegate error if exception code is other", async () => {
    const docId = "123";
    const owner = "owner";

    const err = new PrismaClientKnownRequestError("", {
      code: "P6969",
      clientVersion: "6.5.0",
    });

    jest
      .spyOn(prismaService.document, "findUniqueOrThrow")
      .mockRejectedValue(err);

    await expect(qrService.generateQr(docId, owner)).rejects.toThrow(err);
  });

  it("should generate QR codes successfully when no active QR codes exist", async () => {
    // Simulate that the document is found.
    (prismaService.document.findUniqueOrThrow as jest.Mock).mockResolvedValue(
      mockDocument,
    );
    // Simulate no active QR codes exist.
    (prismaService.qRCode.findMany as jest.Mock).mockResolvedValue([]);
    (prismaService.qRCode.create as jest.Mock)
      .mockResolvedValueOnce(privateQrMock)
      .mockResolvedValueOnce(publicQrMock);
    (prismaService.document.update as jest.Mock).mockResolvedValue({});

    const result = await qrService.generateQr(documentId, ownerName);

    expect(prismaService.document.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { documentID: documentId },
    });

    expect(prismaService.qRCode.findMany).toHaveBeenCalledWith({
      where: { documentId, isActive: true },
    });

    // Since no active QR codes exist, no deactivation should occur.
    expect(prismaService.qRCode.update).not.toHaveBeenCalled();

    const newOwnerNumber = mockDocument.ownerCount + 1;
    expect(prismaService.qRCode.create).toHaveBeenNthCalledWith(1, {
      data: {
        documentId,
        owner: ownerName,
        isPrivate: true,
        isActive: true,
        ownerNumber: newOwnerNumber,
      },
      select: { id: true },
    });
    expect(prismaService.qRCode.create).toHaveBeenNthCalledWith(2, {
      data: {
        documentId,
        owner: ownerName,
        isPrivate: false,
        isActive: true,
        ownerNumber: newOwnerNumber,
      },
      select: { id: true },
    });
    expect(prismaService.document.update).toHaveBeenCalledWith({
      where: { documentID: documentId },
      data: { ownerCount: { increment: 1 } },
    });

    expect(result).toEqual({
      privateId: privateQrMock.id,
      publicId: publicQrMock.id,
    });
  });

  it("should deactivate all active QR codes if they exist and then generate new QR codes", async () => {
    (prismaService.document.findUniqueOrThrow as jest.Mock).mockResolvedValue(
      mockDocument,
    );
    // Simulate that two active QR codes already exist.
    const activeQRCodes = [
      { id: "activePrivate", isActive: true },
      { id: "activePublic", isActive: true },
    ];
    (prismaService.qRCode.findMany as jest.Mock).mockResolvedValue(
      activeQRCodes,
    );
    // Simulate successful deactivation updates.
    (prismaService.qRCode.update as jest.Mock).mockResolvedValue({});
    (prismaService.qRCode.create as jest.Mock)
      .mockResolvedValueOnce(privateQrMock)
      .mockResolvedValueOnce(publicQrMock);
    (prismaService.document.update as jest.Mock).mockResolvedValue({});

    const result = await qrService.generateQr(documentId, ownerName);

    expect(prismaService.document.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { documentID: documentId },
    });

    expect(prismaService.qRCode.findMany).toHaveBeenCalledWith({
      where: { documentId, isActive: true },
    });

    // Expect each active QR code to be deactivated.
    for (const activeQr of activeQRCodes) {
      expect(prismaService.qRCode.update).toHaveBeenCalledWith({
        where: { id: activeQr.id },
        data: { isActive: false },
      });
    }

    const newOwnerNumber = mockDocument.ownerCount + 1;
    expect(prismaService.qRCode.create).toHaveBeenNthCalledWith(1, {
      data: {
        documentId,
        owner: ownerName,
        isPrivate: true,
        isActive: true,
        ownerNumber: newOwnerNumber,
      },
      select: { id: true },
    });
    expect(prismaService.qRCode.create).toHaveBeenNthCalledWith(2, {
      data: {
        documentId,
        owner: ownerName,
        isPrivate: false,
        isActive: true,
        ownerNumber: newOwnerNumber,
      },
      select: { id: true },
    });
    expect(prismaService.document.update).toHaveBeenCalledWith({
      where: { documentID: documentId },
      data: { ownerCount: { increment: 1 } },
    });

    expect(result).toEqual({
      privateId: privateQrMock.id,
      publicId: publicQrMock.id,
    });
  });
});
