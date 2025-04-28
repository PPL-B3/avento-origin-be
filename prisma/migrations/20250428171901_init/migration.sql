-- CreateTable
CREATE TABLE "messages" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "lastLogout" BIGINT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "documentID" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publisher" TEXT NOT NULL,
    "pendingOwner" TEXT,
    "otp" TEXT,
    "otpExpiry" TIMESTAMP(3),
    "otpAttemptCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("documentID")
);

-- CreateTable
CREATE TABLE "qrcodes" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "generatedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "qrcodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "logID" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userID" TEXT NOT NULL,
    "documentID" TEXT,
    "details" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("logID")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "qrcodes" ADD CONSTRAINT "qrcodes_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("documentID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_documentID_fkey" FOREIGN KEY ("documentID") REFERENCES "Document"("documentID") ON DELETE SET NULL ON UPDATE CASCADE;
