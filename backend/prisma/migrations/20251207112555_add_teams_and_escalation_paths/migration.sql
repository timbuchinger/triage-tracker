-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "primaryContactId" TEXT,
    "secondaryContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "creatorId" TEXT,
ADD COLUMN     "teamId" TEXT;

-- AlterTable: First add the column as nullable
ALTER TABLE "Service" ADD COLUMN     "teamId" TEXT;

-- CreateIndex
CREATE INDEX "Team_organizationId_isDefault_idx" ON "Team"("organizationId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "Team_organizationId_name_key" ON "Team"("organizationId", "name");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_secondaryContactId_fkey" FOREIGN KEY ("secondaryContactId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: Create Default team for each organization
-- For each organization, create a Default team and add all users as members
DO $$
DECLARE
    org_record RECORD;
    team_id TEXT;
    first_owner_id TEXT;
BEGIN
    FOR org_record IN SELECT id FROM "Organization"
    LOOP
        -- Find the first owner user in this organization (or any user if no owner)
        SELECT id INTO first_owner_id
        FROM "User"
        WHERE "organizationId" = org_record.id
        ORDER BY
            CASE WHEN role = 'OWNER' THEN 0 ELSE 1 END,
            "createdAt" ASC
        LIMIT 1;

        -- Only create a default team if there's at least one user
        IF first_owner_id IS NOT NULL THEN
            -- Generate a CUID for the team (simplified version for migration)
            team_id := 'team_default_' || org_record.id;

            -- Create the Default team
            INSERT INTO "Team" (id, name, "organizationId", "isDefault", "primaryContactId", "createdAt", "updatedAt")
            VALUES (team_id, 'Default', org_record.id, true, first_owner_id, NOW(), NOW())
            ON CONFLICT ("organizationId", name) DO NOTHING;

            -- Add all users from this organization to the Default team
            INSERT INTO "TeamMember" (id, "teamId", "userId", "createdAt")
            SELECT
                'tm_' || u.id || '_' || team_id,
                team_id,
                u.id,
                NOW()
            FROM "User" u
            WHERE u."organizationId" = org_record.id
            ON CONFLICT ("teamId", "userId") DO NOTHING;

            -- Assign all existing services in this organization to the Default team
            UPDATE "Service"
            SET "teamId" = team_id
            WHERE "organizationId" = org_record.id
            AND "teamId" IS NULL;
        END IF;
    END LOOP;
END $$;

-- Now make teamId required
ALTER TABLE "Service" ALTER COLUMN "teamId" SET NOT NULL;
