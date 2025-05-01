import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  // Seed Users
  const hashedPassword = await argon2.hash("password123");
  const adminPassword = await argon2.hash("adminPassword123");
  
  const users = await prisma.user.createMany({
    data: [
      {
        id: "df2f75a8-2839-47f7-b40c-659217f4bc7d",
        email: "user1@example.com",
        password: hashedPassword,
        role: "USER",
        lastLogout: BigInt(new Date("2025-05-01 15:50:21.56").getTime())
      },
      {
        id: "b25958e1-bd30-411f-824f-afaa203e797c",
        email: "admin@avento.com",
        password: adminPassword,
        role: "ADMIN",
        lastLogout: BigInt(new Date("2025-05-01 15:50:55.684").getTime())
      },
      {
        id: "c43e823f-6a12-49ed-9532-aacd5628ba2f",
        email: "another.user2@another.example.com",
        password: hashedPassword,
        role: "USER",
        lastLogout: BigInt(Date.now())
      },
      {
        id: "e59a7d12-9b3f-48c7-a11d-5fa8e48a35b9",
        email: "yet.another.user3@another.example.com",
        password: hashedPassword,
        role: "USER",
        lastLogout: BigInt(Date.now())
      },
      {
        id: "f3a852d4-1cd2-4abc-9462-9f6782b4f8e1",
        email: "user4@example.com",
        password: hashedPassword,
        role: "USER",
        lastLogout: BigInt(Date.now())
      }
    ],
    skipDuplicates: true,
  });

  // Seed Document table
  const documents = await prisma.document.createMany({
    data: [
      {
        documentID: "a7f9c8de-54ed-453b-9732-8951371b84cb",
        documentName: "3_popular_tokenizers.pdf",
        filePath: "https://avento.sgp1.digitaloceanspaces.com/mahartha.gemilang%40gmail.com_3_popular_tokenizers.pdf_1746114446182.pdf",
        uploadDate: new Date("2025-05-01 15:47:30.359"),
        publisher: "user1@example.com",
      },
      {
        documentID: "a891297c-1049-41bf-9862-86fd25c77510",
        documentName: "index_compression.pdf",
        filePath: "https://avento.sgp1.digitaloceanspaces.com/mahartha.gemilang%40gmail.com_index_compression.pdf_1746114379608.pdf",
        uploadDate: new Date("2025-05-01 15:46:21.418"),
        publisher: "user1@example.com",
      },
    ],
    skipDuplicates: true,
  });

  // Seed QR Codes
  const qrcodes = await prisma.qrCode.createMany({
    data: [
      {
        id: "6b6493f2-dbbc-4386-968e-60f974369159",
        owner: "user1@example.com",
        isPrivate: false,
        isActive: true,
        generatedDate: new Date("2025-05-01 15:47:30.361"),
        documentId: "a7f9c8de-54ed-453b-9732-8951371b84cb",
      },
      {
        id: "f869f321-a970-4d5c-99aa-07d3e35cbefe",
        owner: "user1@example.com",
        isPrivate: true,
        isActive: true,
        generatedDate: new Date("2025-05-01 15:47:30.361"),
        documentId: "a7f9c8de-54ed-453b-9732-8951371b84cb",
      },
      {
        id: "13b5b18f-db4e-4b6b-a015-41e6dcfde4b6",
        owner: "user1@example.com",
        isPrivate: false,
        isActive: false,
        generatedDate: new Date("2025-05-01 15:46:21.434"),
        documentId: "a891297c-1049-41bf-9862-86fd25c77510",
      },
      {
        id: "508857e4-6b23-436d-8a6b-bcfd088a11f1",
        owner: "user1@example.com",
        isPrivate: true,
        isActive: false,
        generatedDate: new Date("2025-05-01 15:46:21.434"),
        documentId: "a891297c-1049-41bf-9862-86fd25c77510",
      },
      {
        id: "58743324-8e3a-44bc-858d-21f44e184cd5",
        owner: "another.user2@another.example.com",
        isPrivate: false,
        isActive: true,
        generatedDate: new Date("2025-05-01 15:49:32.571"),
        documentId: "a891297c-1049-41bf-9862-86fd25c77510",
      },
      {
        id: "72d972af-8f9a-43da-be0e-a47105df17cf",
        owner: "another.user2@another.example.com",
        isPrivate: true,
        isActive: true,
        generatedDate: new Date("2025-05-01 15:49:32.571"),
        documentId: "a891297c-1049-41bf-9862-86fd25c77510",
      },
    ],
    skipDuplicates: true,
  });

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

  console.log(`Seeded: ${users.count} users`);
  console.log(`Seeded: ${documents.count} documents`);
  console.log(`Seeded: ${qrcodes.count} QR codes`);
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
