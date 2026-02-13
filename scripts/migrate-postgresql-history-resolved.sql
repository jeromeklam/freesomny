-- FreeSomnia: Add resolved URL/headers to HistoryEntry
-- Migration: 20260213134214_add_resolved_to_history
--
-- Run this on your PostgreSQL production database:
--   psql "$DATABASE_URL" -f scripts/migrate-postgresql-history-resolved.sql

ALTER TABLE "HistoryEntry" ADD COLUMN IF NOT EXISTS "resolvedUrl" TEXT;
ALTER TABLE "HistoryEntry" ADD COLUMN IF NOT EXISTS "resolvedHeaders" TEXT;
