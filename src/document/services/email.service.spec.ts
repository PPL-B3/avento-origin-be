import { EmailService } from "./email.service";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { DocumentRepository } from "../repositories/document.repository";

jest.mock("nodemailer");

describe("EmailService", () => {
  let emailService: EmailService;
  let configService: Partial<ConfigService>;
  let documentRepo: Partial<DocumentRepository>;
  let sendMailMock: jest.Mock;

  beforeEach(() => {
    // Create a fake configService returning Gmail credentials.
    configService = {
      get: jest.fn((key: string) => {
        if (key === "GMAIL_USER") return "test@gmail.com";
        if (key === "GMAIL_PASS") return "secret";
        if (key === "FE_URL") return "http://sample-url.com";
        return null;
      }),
    };

    documentRepo = {
      findDocumentById: jest.fn(),
    };

    // Create a fake transporter with sendMail method.
    sendMailMock = jest.fn().mockResolvedValue("ok");
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: sendMailMock,
    });

    emailService = new EmailService(
      configService as ConfigService,
      documentRepo as DocumentRepository
    );
  });

  describe("sendOwnershipTransferEmail", () => {
    const email = "recipient@example.com";
    const documentName = "Important Doc";
    const owner = "Alice";
    const publisher = "Bob";
    const documentId = "doc-123";

    it("should send an email with correct content", async () => {
      const fakeDocument = {
        documentID: documentId,
        qrCode: [
          { id: "qr-private", isPrivate: true },
          { id: "qr-public", isPrivate: false },
        ],
      };
      (documentRepo.findDocumentById as jest.Mock).mockResolvedValue(
        fakeDocument
      );

      await emailService.sendOwnershipTransferEmail(
        email,
        documentName,
        owner,
        publisher,
        documentId
      );
      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const callArgs = sendMailMock.mock.calls[0][0];

      // Verify the "from" field uses the GMAIL_USER
      expect(callArgs.from).toBe(`"Avento Origin" <test@gmail.com>`);
      expect(callArgs.to).toBe(email);
      expect(callArgs.subject).toBe("Tautan Pengalihan Kepemilikan Dokumen");
      // Check that the html contains proper owner, documentName, publisher and URL.
      expect(callArgs.html).toContain(`<code>${owner}</code>`);
      expect(callArgs.html).toContain(`<code>${documentName}</code>`);
      expect(callArgs.html).toContain(`<code>${publisher}</code>`);
      expect(callArgs.html).toContain(`http://sample-url.com/transfer-request`);
    });

    it("should propagate errors thrown by sendMail", async () => {
      const fakeDocument = {
        documentID: documentId,
        qrCode: [
          { id: "qr-private", isPrivate: true },
          { id: "qr-public", isPrivate: false },
        ],
      };
      (documentRepo.findDocumentById as jest.Mock).mockResolvedValue(
        fakeDocument
      );
      sendMailMock.mockRejectedValueOnce(new Error("Send failed"));
      await expect(
        emailService.sendOwnershipTransferEmail(
          email,
          documentName,
          owner,
          publisher,
          documentId
        )
      ).rejects.toThrow("Send failed");
    });
  });

  describe("sendPrivateAccessEmail", () => {
    const email = "user@example.com";
    const otp = "123456";
    const documentName = "Confidential.pdf";

    it("should send an email with correct content", async () => {
      await emailService.sendPrivateAccessEmail(email, otp, documentName);

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const callArgs = sendMailMock.mock.calls[0][0];

      // Verify the "from" field uses the GMAIL_USER
      expect(callArgs.from).toBe(`"Avento Origin" <test@gmail.com>`);
      expect(callArgs.to).toBe(email);
      expect(callArgs.subject).toBe("Akses Dokumen Pribadi");

      // Verify email HTML contains OTP and document name
      expect(callArgs.html).toContain(`<code>${documentName}</code>`);
      expect(callArgs.html).toContain(`<strong>${otp}</strong>`);
      expect(callArgs.html).toContain("OTP ini berlaku selama 8 menit");
    });

    it("should propagate errors thrown by sendMail", async () => {
      sendMailMock.mockRejectedValueOnce(new Error("SMTP failure"));

      await expect(
        emailService.sendPrivateAccessEmail(email, otp, documentName)
      ).rejects.toThrow("SMTP failure");
    });
  });
});
