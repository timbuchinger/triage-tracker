/*
  Warnings:

  - A unique constraint covering the columns `[slackChannelId]` on the table `Incident` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'HIGHLIGHTED_MESSAGE';

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "slackChannelId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Incident_slackChannelId_key" ON "Incident"("slackChannelId");
