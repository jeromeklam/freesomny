-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "method" TEXT NOT NULL DEFAULT 'GET',
    "url" TEXT NOT NULL DEFAULT '',
    "queryParams" TEXT NOT NULL DEFAULT '[]',
    "headers" TEXT NOT NULL DEFAULT '[]',
    "bodyType" TEXT NOT NULL DEFAULT 'none',
    "body" TEXT NOT NULL DEFAULT '',
    "bodyDescription" TEXT NOT NULL DEFAULT '',
    "authType" TEXT NOT NULL DEFAULT 'inherit',
    "authConfig" TEXT NOT NULL DEFAULT '{}',
    "preScript" TEXT,
    "postScript" TEXT,
    "timeout" INTEGER,
    "followRedirects" TEXT NOT NULL DEFAULT 'inherit',
    "verifySsl" TEXT NOT NULL DEFAULT 'inherit',
    "proxy" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "folderId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Request_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Request" ("authConfig", "authType", "body", "bodyDescription", "bodyType", "createdAt", "description", "folderId", "followRedirects", "headers", "id", "method", "name", "postScript", "preScript", "proxy", "queryParams", "sortOrder", "timeout", "updatedAt", "url", "verifySsl") SELECT "authConfig", "authType", "body", "bodyDescription", "bodyType", "createdAt", "description", "folderId", "followRedirects", "headers", "id", "method", "name", "postScript", "preScript", "proxy", "queryParams", "sortOrder", "timeout", "updatedAt", "url", "verifySsl" FROM "Request";
DROP TABLE "Request";
ALTER TABLE "new_Request" RENAME TO "Request";
CREATE INDEX "Request_folderId_idx" ON "Request"("folderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
