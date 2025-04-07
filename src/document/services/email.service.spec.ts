import { EmailService } from "./email.service";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

jest.mock("nodemailer");

describe("EmailService", () => {
  let emailService: EmailService;
  let configService: Partial<ConfigService>;
  let sendMailMock: jest.Mock;

  beforeEach(() => {
    // Create a fake configService returning Gmail credentials.
    configService = {
      get: jest.fn((key: string) => {
        if (key === "GMAIL_USER") return "test@gmail.com";
        if (key === "GMAIL_PASS") return "secret";
        return null;
      }),
    };

    // Create a fake transporter with sendMail method.
    sendMailMock = jest.fn().mockResolvedValue("ok");
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: sendMailMock,
    });

    emailService = new EmailService(configService as ConfigService);
  });

  describe("sendOwnershipTransferEmail", () => {
    const email = "recipient@example.com";
    const documentName = "Important Doc";
    const owner = "Alice";
    const publisher = "Bob";
    const documentId = "doc-123";

    it("should send an email with correct content", async () => {
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
      expect(callArgs.html).toContain(`http://sample-url.com/${documentId}`);
    });

    it("should propagate errors thrown by sendMail", async () => {
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
});
