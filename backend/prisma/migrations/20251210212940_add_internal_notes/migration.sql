/*
  Warnings:

  - You are about to drop the column `createdAt` on the `SlackUserMapping` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `SlackUserMapping` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "internalNotes" TEXT;

-- AlterTable
ALTER TABLE "SlackUserMapping" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt";

-- RenameIndex
ALTER INDEX "SlackUserMapping_user_integration_key" RENAME TO "SlackUserMapping_userId_slackIntegrationId_key";
