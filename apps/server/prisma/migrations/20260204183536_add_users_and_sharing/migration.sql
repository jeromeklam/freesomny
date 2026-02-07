-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FolderShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'read',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FolderShare_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FolderShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnvironmentShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "environmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'read',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnvironmentShare_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EnvironmentShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Environment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Environment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Environment" ("createdAt", "description", "id", "isActive", "name", "updatedAt") SELECT "createdAt", "description", "id", "isActive", "name", "updatedAt" FROM "Environment";
DROP TABLE "Environment";
ALTER TABLE "new_Environment" RENAME TO "Environment";
CREATE INDEX "Environment_userId_idx" ON "Environment"("userId");
CREATE TABLE "new_Folder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "parentId" TEXT,
    "headers" TEXT NOT NULL DEFAULT '[]',
    "queryParams" TEXT NOT NULL DEFAULT '[]',
    "authType" TEXT NOT NULL DEFAULT 'inherit',
    "authConfig" TEXT NOT NULL DEFAULT '{}',
    "preScript" TEXT,
    "postScript" TEXT,
    "baseUrl" TEXT,
    "timeout" INTEGER,
    "followRedirects" TEXT NOT NULL DEFAULT 'inherit',
    "verifySsl" TEXT NOT NULL DEFAULT 'inherit',
    "proxy" TEXT,
    "userId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Folder" ("authConfig", "authType", "baseUrl", "createdAt", "description", "followRedirects", "headers", "id", "name", "parentId", "postScript", "preScript", "proxy", "queryParams", "sortOrder", "timeout", "updatedAt", "verifySsl") SELECT "authConfig", "authType", "baseUrl", "createdAt", "description", "followRedirects", "headers", "id", "name", "parentId", "postScript", "preScript", "proxy", "queryParams", "sortOrder", "timeout", "updatedAt", "verifySsl" FROM "Folder";
DROP TABLE "Folder";
ALTER TABLE "new_Folder" RENAME TO "Folder";
CREATE INDEX "Folder_parentId_idx" ON "Folder"("parentId");
CREATE INDEX "Folder_userId_idx" ON "Folder"("userId");
CREATE TABLE "new_HistoryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "requestHeaders" TEXT NOT NULL,
    "requestBody" TEXT,
    "responseStatus" INTEGER NOT NULL,
    "responseHeaders" TEXT NOT NULL,
    "responseBody" TEXT,
    "responseTime" INTEGER NOT NULL,
    "responseSize" INTEGER NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HistoryEntry" ("createdAt", "id", "method", "requestBody", "requestHeaders", "responseBody", "responseHeaders", "responseSize", "responseStatus", "responseTime", "url") SELECT "createdAt", "id", "method", "requestBody", "requestHeaders", "responseBody", "responseHeaders", "responseSize", "responseStatus", "responseTime", "url" FROM "HistoryEntry";
DROP TABLE "HistoryEntry";
ALTER TABLE "new_HistoryEntry" RENAME TO "HistoryEntry";
CREATE INDEX "HistoryEntry_createdAt_idx" ON "HistoryEntry"("createdAt");
CREATE INDEX "HistoryEntry_userId_idx" ON "HistoryEntry"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "FolderShare_folderId_idx" ON "FolderShare"("folderId");

-- CreateIndex
CREATE INDEX "FolderShare_userId_idx" ON "FolderShare"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FolderShare_folderId_userId_key" ON "FolderShare"("folderId", "userId");

-- CreateIndex
CREATE INDEX "EnvironmentShare_environmentId_idx" ON "EnvironmentShare"("environmentId");

-- CreateIndex
CREATE INDEX "EnvironmentShare_userId_idx" ON "EnvironmentShare"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentShare_environmentId_userId_key" ON "EnvironmentShare"("environmentId", "userId");
