/*
  Warnings:

  - Added the required column `lastLogout` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "lastLogout",
ADD COLUMN     "lastLogout" BIGINT NOT NULL;
