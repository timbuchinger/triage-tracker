-- Add thumbsCount to timeline events
-- Add a non-nullable integer column with default 0

ALTER TABLE "TimelineEvent" ADD COLUMN "thumbsCount" INTEGER NOT NULL DEFAULT 0;
