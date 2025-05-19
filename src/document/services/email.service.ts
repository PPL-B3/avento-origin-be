import * as nodemailer from "nodemailer";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";
import { DocumentRepository } from "../repositories/document.repository";

@Injectable()
export class EmailService {
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    private readonly documentRepo: DocumentRepository
  ) {
    this.transporter = nodemailer.createTransport({
      secure: true,
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
    documentId: string
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

  async sendPrivateAccessEmail(
    email: string,
    otp: string,
    documentName: string
  ): Promise<void> {
    const htmlContent = `
      <p>Anda telah meminta akses ke dokumen pribadi berjudul <code>${documentName}</code>.</p>
      <p>Gunakan OTP berikut untuk melanjutkan: <strong>${otp}</strong>.</p>
      <p>OTP ini berlaku selama 8 menit. Jangan bagikan OTP ini kepada siapapun.</p>
    `;

    await this.transporter.sendMail({
      from: `"Avento Origin" <${this.configService.get<string>("GMAIL_USER")}>`,
      to: email,
      subject: "Akses Dokumen Pribadi",
      html: htmlContent,
    });
  }

  async sendReverseOwnershipEmails(
    gainingOwner: string,
    losingOwner: string,
    documentName: string,
    publicQrCodeId: string,
    privateQrCodeId: string
  ): Promise<void> {
    const domain = "https://avento-origin.vercel.app/metadata/";
    const publicQrURL = `${domain}${publicQrCodeId}`;
    const privateQrURL = `${domain}${privateQrCodeId}`;

    const ownershipGrantedHTML = `
    <p>
      Anda telah diberikan kepemilikan atas dokumen <strong>${documentName}</strong> melalui <strong>Avento Origin</strong>.
    </p>
    <p>
      Ini adalah informasi QR Code Anda:
    </p>
    <ul>
      <li>
        <strong>Public QR Code ID (untuk verifikasi kepemilikan):</strong><br />
        <a href="${publicQrURL}" target="_blank">${publicQrURL}</a>
      </li>
      <li>
        <strong>Private QR Code ID (Penggunaan Pribadi untuk transfer & melihat dokumen):</strong><br />
        <a href="${privateQrURL}" target="_blank">${privateQrURL}</a>
      </li>
    </ul>
  `;

    const ownershipRevokedHTML = `
<p>
  Kepemilikan Anda atas dokumen <strong>${documentName}</strong> telah dicabut oleh <strong>Avento Origin</strong>.
</p>
<p>
  Jika Anda merasa ini adalah kesalahan, mohon hubungi administrator Avento Origin.
</p>
`;

    await this.transporter.sendMail({
      from: `"Avento Origin" <${this.configService.get<string>("GMAIL_USER")}>`,
      to: gainingOwner,
      subject: "Pemberian Kepemilikan Dokumen",
      html: ownershipGrantedHTML,
    });

    await this.transporter.sendMail({
      from: `"Avento Origin" <${this.configService.get<string>("GMAIL_USER")}>`,
      to: losingOwner,
      subject: "Pencabutan Kepemilikan Dokumen",
      html: ownershipRevokedHTML,
    });
  }
}
