-- Delete all existing services
DELETE FROM "Service";

-- CreateEnum
CREATE TYPE "ServiceLinkType" AS ENUM ('GRAFANA', 'GIT', 'DYNATRACE');

-- CreateTable
CREATE TABLE "ServiceLink" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "type" "ServiceLinkType" NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceLink_serviceId_idx" ON "ServiceLink"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceLink_serviceId_type_key" ON "ServiceLink"("serviceId", "type");

-- AddForeignKey
ALTER TABLE "ServiceLink" ADD CONSTRAINT "ServiceLink_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
