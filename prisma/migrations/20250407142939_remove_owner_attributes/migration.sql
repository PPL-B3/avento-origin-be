/*
  Warnings:

  - You are about to drop the column `ownerCount` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `ownerNumber` on the `qrcodes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Document" DROP COLUMN "ownerCount";

-- AlterTable
ALTER TABLE "qrcodes" DROP COLUMN "ownerNumber";
