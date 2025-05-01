import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  // Seed QR Code OTPs
  const qrcodeOtps = await prisma.qrCodeOTP.createMany({
    data: [
      {
        id: "ef0ca680-7988-4cec-b92b-a8b1e409d490",
        qrCodeId: "508857e4-6b23-436d-8a6b-bcfd088a11f1",
        otp: "457596",
        expiry: new Date("2025-05-01 15:55:15.771"),
        attemptCount: 0,
        cooldown: new Date("2025-05-01 15:46:48.181"),
        createdAt: new Date("2025-05-01 15:46:48.183"),
        updatedAt: new Date("2025-05-01 15:47:15.772"),
      },
      {
        id: "d761d58a-081e-419d-a2a8-b41b1ce9f9df",
        qrCodeId: "72d972af-8f9a-43da-be0e-a47105df17cf",
        otp: "378133",
        expiry: new Date("2025-05-01 15:56:24.629"),
        attemptCount: 0,
        cooldown: new Date("2025-05-01 15:49:41.901"),
        createdAt: new Date("2025-05-01 15:49:41.902"),
        updatedAt: new Date("2025-05-01 15:56:24.63"),
      },
    ],
    skipDuplicates: true,
  });

  // Keep existing message seed if needed
  await prisma.message.createMany({
    data: [
      { content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit." },
      {
        content: "Integer pretium lobortis enim, at accumsan sem egestas vel.",
      },
      {
        content:
          "Integer sed posuere ante. Praesent nunc dui, ultrices et mi at, pellentesque vehicula enim.",
      },
    ],
    skipDuplicates: true,
  });

  console.log(`Seeded: ${qrcodeOtps.count} QR code OTPs`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });
