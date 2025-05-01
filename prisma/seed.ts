import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const environment = process.env.NODE_ENV ?? "development";

async function main() {
  // Load environment-specific seed data
  const seedDataPath = path.join(__dirname, `seed-data/${environment}`);
  const defaultDataPath = path.join(__dirname, "seed-data/default");

  // Check if environment-specific seed data directory exists
  if (!fs.existsSync(seedDataPath)) {
    console.warn(`No seed data found for ${environment} environment`);
  } else {
    console.log(`Running seed for ${environment} environment`);
    await seedFromEnvironment(seedDataPath);
  }

  // Check if default seed data directory exists
  if (!fs.existsSync(defaultDataPath)) {
    console.warn(`No default seed data found`);
  } else {
    console.log(`Running default seed data`);
    await seedFromEnvironment(defaultDataPath);
  }

  // Run admin seeder for production environment
  if (environment === "production") {
    await seedAdminFromEnv();
  }
}

async function seedAdminFromEnv() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      "ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping admin seeding"
    );
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    return;
  }

  const hash = await argon2.hash(password);
  await prisma.user.create({
    data: {
      email,
      password: hash,
      role: "ADMIN",
      lastLogout: BigInt(Date.now()),
    },
  });
  console.log(`✅ Created admin user from environment variables: ${email}`);
}

async function seedFromEnvironment(seedDataPath: string) {
  try {
    await seedUsers(seedDataPath);
    await seedDocuments(seedDataPath);
    await seedQRCodes(seedDataPath);
    await seedQRCodeOTPs(seedDataPath);
    await seedAuditLogs(seedDataPath);
    await seedMessages(seedDataPath);
  } catch (error) {
    console.error("Error seeding from environment:", error);
    throw error;
  }
}

async function seedUsers(seedDataPath: string) {
  const filePath = path.join(seedDataPath, "users.json");
  if (!fs.existsSync(filePath)) return;

  const usersData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // Hash passwords before inserting
  for (const user of usersData) {
    if (user.password) {
      user.password = await argon2.hash(user.password);
    }
    if (user.lastLogout && typeof user.lastLogout === "string") {
      user.lastLogout = BigInt(new Date(user.lastLogout).getTime());
    }
  }

  const users = await prisma.user.createMany({
    data: usersData,
    skipDuplicates: true,
  });
  console.log(`Seeded: ${users.count} users`);
}

async function seedDocuments(seedDataPath: string) {
  const filePath = path.join(seedDataPath, "documents.json");
  if (!fs.existsSync(filePath)) return;

  const documentsData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // Convert date strings to Date objects
  for (const doc of documentsData) {
    if (doc.uploadDate) {
      doc.uploadDate = new Date(doc.uploadDate);
    }
  }

  const documents = await prisma.document.createMany({
    data: documentsData,
    skipDuplicates: true,
  });
  console.log(`Seeded: ${documents.count} documents`);
}

async function seedQRCodes(seedDataPath: string) {
  const filePath = path.join(seedDataPath, "qrcodes.json");
  if (!fs.existsSync(filePath)) return;

  const qrcodesData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // Convert date strings to Date objects
  for (const qrcode of qrcodesData) {
    if (qrcode.generatedDate) {
      qrcode.generatedDate = new Date(qrcode.generatedDate);
    }
  }

  const qrcodes = await prisma.qrCode.createMany({
    data: qrcodesData,
    skipDuplicates: true,
  });
  console.log(`Seeded: ${qrcodes.count} QR codes`);
}

async function seedQRCodeOTPs(seedDataPath: string) {
  const filePath = path.join(seedDataPath, "qrcodeotps.json");
  if (!fs.existsSync(filePath)) return;

  const qrcodeOtpsData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // Convert date strings to Date objects
  for (const otp of qrcodeOtpsData) {
    if (otp.expiry) otp.expiry = new Date(otp.expiry);
    if (otp.cooldown) otp.cooldown = new Date(otp.cooldown);
    if (otp.createdAt) otp.createdAt = new Date(otp.createdAt);
    if (otp.updatedAt) otp.updatedAt = new Date(otp.updatedAt);
  }

  const qrcodeOtps = await prisma.qrCodeOTP.createMany({
    data: qrcodeOtpsData,
    skipDuplicates: true,
  });
  console.log(`Seeded: ${qrcodeOtps.count} QR code OTPs`);
}

async function seedAuditLogs(seedDataPath: string) {
  const filePath = path.join(seedDataPath, "auditlogs.json");
  if (!fs.existsSync(filePath)) return;

  const auditLogsData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // Convert date strings to Date objects
  for (const log of auditLogsData) {
    if (log.timestamp) {
      log.timestamp = new Date(log.timestamp);
    }
  }

  const auditLogs = await prisma.auditLog.createMany({
    data: auditLogsData,
    skipDuplicates: true,
  });
  console.log(`Seeded: ${auditLogs.count} audit logs`);
}

async function seedMessages(seedDataPath: string) {
  const filePath = path.join(seedDataPath, "messages.json");
  if (!fs.existsSync(filePath)) return;

  const messagesData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  await prisma.message.createMany({
    data: messagesData,
    skipDuplicates: true,
  });
  console.log(`Seeded: ${messagesData.length} messages`);
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
