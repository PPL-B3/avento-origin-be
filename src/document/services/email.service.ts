import * as nodemailer from "nodemailer";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";
import { DocumentRepository } from "../repositories/document.repository";

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private documentRepo: DocumentRepository,
  ) {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: configService.get<string>("GMAIL_USER"),
        pass: configService.get<string>("GMAIL_PASS"),
      },
    });
  }

  async sendOwnershipTransferEmail(
    email: string,
    documentName: string,
    owner: string,
    publisher: string,
    documentId: string,
  ): Promise<void> {
    const document = await this.documentRepo.findDocumentById(documentId);
    const qrCodes = document.qrCode.slice(-2);
    const publicQrCode = qrCodes.find((qr) => !qr.isPrivate);
    const attemptURL = `${this.configService.get<string>("FE_URL")}/transfer-request/${publicQrCode?.id}`;
    const htmlContent = `
  <p><code>${owner}</code> mengundang Anda untuk mengambil alih kepemilikan PDF berjudul <code>${documentName}</code> yang diterbitkan oleh <code>${publisher}</code>.</p>
  <p>Silakan klik <a href="${attemptURL}">tautan ini</a>, lalu minta <code>${owner}</code> untuk memberikan OTP.</p>
  `;

    await this.transporter.sendMail({
      from: `"Avento Origin" <${this.configService.get<string>("GMAIL_USER")}>`,
      to: email,
      subject: "Tautan Pengalihan Kepemilikan Dokumen",
      html: htmlContent,
    });
  }
}
