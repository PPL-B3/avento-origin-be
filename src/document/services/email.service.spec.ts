import { Test, TestingModule } from "@nestjs/testing";
import { EmailService } from "../services/email.service";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: "test-message-id" }),
  }),
}));

describe("EmailService", () => {
  let service: EmailService;
  let configService: ConfigService;
  let transporter: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values = {
                GMAIL_USER: "gmail@test.com",
                GMAIL_PASS: "secret",
              };
              return values[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
    transporter = (nodemailer.createTransport as jest.Mock)();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should send ownership transfer email successfully", async () => {
    await service.sendOwnershipTransferEmail(
      "user@example.com",
      "Test Document",
      "owner",
      "publisher",
      "doc-id-123"
    );
    expect(transporter.sendMail).toHaveBeenCalledWith({
      from: `"Avento Origin" <gmail@test.com>`,
      to: "user@example.com",
      subject: "Tautan Pengalihan Kepemilikan Dokumen",
      html: expect.stringContaining("Test Document"),
    });
  });

  it("should propagate error if sendMail fails", async () => {
    transporter.sendMail.mockRejectedValueOnce(new Error("Email failure"));
    await expect(
      service.sendOwnershipTransferEmail(
        "user@example.com",
        "Test Document",
        "owner",
        "publisher",
        "doc-id-123"
      )
    ).rejects.toThrow("Email failure");
  });
});
