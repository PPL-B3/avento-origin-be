-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "otp" TEXT,
ADD COLUMN     "otpAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otpExpiry" TIMESTAMP(3),
ADD COLUMN     "pendingOwner" TEXT;
