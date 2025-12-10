-- Create default Team per Organization where services exist with NULL teamId
INSERT INTO "Team" (id, name, "organizationId", "isDefault", "primaryContactId", "createdAt", "updatedAt")
SELECT 'team_default_' || o.id, 'Default', o.id, true,
       (SELECT id FROM "User" u WHERE u."organizationId" = o.id ORDER BY CASE WHEN role='OWNER' THEN 0 ELSE 1 END, "createdAt" ASC LIMIT 1),
       NOW(), NOW()
FROM "Organization" o
WHERE EXISTS (SELECT 1 FROM "Service" s WHERE s."organizationId" = o.id AND s."teamId" IS NULL)
ON CONFLICT ("organizationId", name) DO NOTHING;

-- Add TeamMember rows for users in those orgs
INSERT INTO "TeamMember" (id, "teamId", "userId", "createdAt")
SELECT 'tm_' || u.id || '_' || ('team_default_' || u."organizationId"), ('team_default_' || u."organizationId"), u.id, NOW()
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "Service" s WHERE s."organizationId" = u."organizationId" AND s."teamId" IS NULL)
ON CONFLICT ("teamId", "userId") DO NOTHING;

-- Assign services with NULL teamId to the default team for their org
UPDATE "Service"
SET "teamId" = ('team_default_' || "organizationId")
WHERE "teamId" IS NULL;

-- Enforce NOT NULL
ALTER TABLE "Service" ALTER COLUMN "teamId" SET NOT NULL;
