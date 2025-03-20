/*
  Warnings:

  - You are about to drop the column `ownerName` on the `Document` table. All the data in the column will be lost.
  - Added the required column `publisher` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `owner` to the `qrcodes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Document" DROP COLUMN "ownerName",
ADD COLUMN     "publisher" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "qrcodes" ADD COLUMN     "owner" TEXT NOT NULL;
