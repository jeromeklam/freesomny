-- CreateTable
CREATE TABLE "Folder" (
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
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Request" (
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
    "folderId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Request_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EnvironmentVariable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'string',
    "scope" TEXT NOT NULL DEFAULT 'global',
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "environmentId" TEXT NOT NULL,
    CONSTRAINT "EnvironmentVariable_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocalOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "environmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'local',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HistoryEntry" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "data" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Folder_parentId_idx" ON "Folder"("parentId");

-- CreateIndex
CREATE INDEX "Request_folderId_idx" ON "Request"("folderId");

-- CreateIndex
CREATE INDEX "EnvironmentVariable_environmentId_idx" ON "EnvironmentVariable"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentVariable_environmentId_key_scope_key" ON "EnvironmentVariable"("environmentId", "key", "scope");

-- CreateIndex
CREATE INDEX "LocalOverride_environmentId_idx" ON "LocalOverride"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalOverride_environmentId_key_userId_key" ON "LocalOverride"("environmentId", "key", "userId");

-- CreateIndex
CREATE INDEX "HistoryEntry_createdAt_idx" ON "HistoryEntry"("createdAt");
