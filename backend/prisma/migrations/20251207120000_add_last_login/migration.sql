-- Migration: add lastLogin column to User
BEGIN;
ALTER TABLE "User" ADD COLUMN "lastLogin" TIMESTAMP(3);
COMMIT;
