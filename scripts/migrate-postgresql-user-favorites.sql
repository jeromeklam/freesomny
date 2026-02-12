-- FreeSomnia: Add UserFavorite table (per-user favorites)
-- Migration: 20260212084603_add_user_favorites
--
-- Run this on your PostgreSQL production database:
--   psql "$DATABASE_URL" -f scripts/migrate-postgresql-user-favorites.sql

CREATE TABLE IF NOT EXISTS "UserFavorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserFavorite_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserFavorite_userId_idx" ON "UserFavorite"("userId");
CREATE INDEX IF NOT EXISTS "UserFavorite_requestId_idx" ON "UserFavorite"("requestId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserFavorite_userId_requestId_key" ON "UserFavorite"("userId", "requestId");
