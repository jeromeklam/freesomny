-- FreeSomnia: Add isProtected to EnvironmentVariable
-- Migration: 20260212091702_add_protected_variables
--
-- Run this on your PostgreSQL production database:
--   psql "$DATABASE_URL" -f scripts/migrate-postgresql-protected-vars.sql

ALTER TABLE "EnvironmentVariable" ADD COLUMN IF NOT EXISTS "isProtected" BOOLEAN NOT NULL DEFAULT false;
