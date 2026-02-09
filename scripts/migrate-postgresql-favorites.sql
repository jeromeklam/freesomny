-- FreeSomnia: Add isFavorite to Request for PostgreSQL
-- Migration: 20260209162953_add_request_is_favorite
--
-- Run this on your PostgreSQL production database:
--   psql "$DATABASE_URL" -f scripts/migrate-postgresql-favorites.sql

ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "isFavorite" BOOLEAN NOT NULL DEFAULT false;
