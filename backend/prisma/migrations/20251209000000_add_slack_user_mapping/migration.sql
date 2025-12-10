-- Add flow column to OAuthState
ALTER TABLE "OAuthState" ADD COLUMN "flow" TEXT;

-- Create SlackUserMapping table
CREATE TABLE "SlackUserMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slackIntegrationId" TEXT NOT NULL,
    "slackUserId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackUserMapping_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "SlackUserMapping_user_integration_key" ON "SlackUserMapping"("userId", "slackIntegrationId");
CREATE INDEX "SlackUserMapping_slackUserId_idx" ON "SlackUserMapping"("slackUserId");

-- Foreign keys
ALTER TABLE "SlackUserMapping" ADD CONSTRAINT "SlackUserMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SlackUserMapping" ADD CONSTRAINT "SlackUserMapping_slackIntegrationId_fkey" FOREIGN KEY ("slackIntegrationId") REFERENCES "SlackIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
