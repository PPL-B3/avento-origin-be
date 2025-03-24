-- CreateTable
CREATE TABLE "qrcodes" (
    "id" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "qrcodes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "qrcodes" ADD CONSTRAINT "qrcodes_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("documentID") ON DELETE RESTRICT ON UPDATE CASCADE;
