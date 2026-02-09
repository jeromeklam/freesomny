-- FreeSomnia: Email Verification + Admin Approval migration for PostgreSQL
-- Migration: 20260209090256_add_email_verification
--
-- Run this on your PostgreSQL production database:
--   psql "$DATABASE_URL" -f scripts/migrate-postgresql.sql
--
-- After running, mark the migration as applied:
--   pnpm --filter @api-client/server prisma migrate resolve --applied 20260209090256_add_email_verification

-- Add email verification columns
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifyToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifyTokenExpiresAt" TIMESTAMP(3);

-- Change isActive default to false (new registrations require admin approval)
ALTER TABLE "User" ALTER COLUMN "isActive" SET DEFAULT false;

-- Mark all existing active users as verified (so they can still log in)
UPDATE "User" SET "isVerified" = true WHERE "isActive" = true;
