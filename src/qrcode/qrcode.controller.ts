import { Body, Controller, Post } from "@nestjs/common";
import { QrcodeService } from "./qrcode.service";
import { QRTransferDTO } from "./dto";

@Controller("qrcode")
export class QrcodeController {
  constructor(private readonly qrService: QrcodeService) {}

  @Post("generate")
  async generate(@Body() qrTransferDto: QRTransferDTO) {
    return this.qrService.generateQr(
      qrTransferDto.documentId,
      qrTransferDto.email,
    );
  }
}
