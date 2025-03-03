/*
  Warnings:

  - Changed the type of `lastLogout` on the `users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "lastLogout",
ADD COLUMN     "lastLogout" TIMESTAMP(3) NOT NULL;
