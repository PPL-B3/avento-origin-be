import { Test, TestingModule } from "@nestjs/testing";
import { QrcodeController } from "./qrcode.controller";
import { QrcodeService } from "./qrcode.service";
import { QRTransferDTO } from "./dto";

describe("QrcodeController", () => {
  let controller: QrcodeController;
  let service: QrcodeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QrcodeController],
      providers: [
        { provide: QrcodeService, useValue: { generateQr: jest.fn() } },
      ],
    }).compile();

    controller = module.get<QrcodeController>(QrcodeController);
    service = module.get<QrcodeService>(QrcodeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("generate", () => {
    it("should call generateQr with the correct parameters and return its result", async () => {
      const qrTransferDto: QRTransferDTO = {
        documentId: "doc123",
        email: "test@example.com",
      };

      const expectedResult = { privateId: "private123", publicId: "public123" };
      jest.spyOn(service, "generateQr").mockResolvedValue(expectedResult);

      const result = await controller.generate(qrTransferDto);

      // Verify that the controller calls the service with the correct arguments.
      expect(service.generateQr).toHaveBeenCalledWith(
        qrTransferDto.documentId,
        qrTransferDto.email,
      );
      expect(result).toEqual(expectedResult);
    });

    it("should throw an error if generateQr throws an error", async () => {
      const qrTransferDto: QRTransferDTO = {
        documentId: "doc123",
        email: "test@example.com",
      };

      const errorMessage = "Something went wrong";
      // Set up the mock to reject with an error.
      jest
        .spyOn(service, "generateQr")
        .mockRejectedValue(new Error(errorMessage));

      await expect(controller.generate(qrTransferDto)).rejects.toThrow(
        errorMessage,
      );
    });
  });
});
