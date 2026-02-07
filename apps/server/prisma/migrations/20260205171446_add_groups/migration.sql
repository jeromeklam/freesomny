-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "groupId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Environment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Environment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Environment" ("createdAt", "description", "id", "isActive", "name", "updatedAt", "userId") SELECT "createdAt", "description", "id", "isActive", "name", "updatedAt", "userId" FROM "Environment";
DROP TABLE "Environment";
ALTER TABLE "new_Environment" RENAME TO "Environment";
CREATE INDEX "Environment_userId_idx" ON "Environment"("userId");
CREATE INDEX "Environment_groupId_idx" ON "Environment"("groupId");
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
    "groupId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Folder_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Folder" ("authConfig", "authType", "baseUrl", "createdAt", "description", "followRedirects", "headers", "id", "name", "parentId", "postScript", "preScript", "proxy", "queryParams", "sortOrder", "timeout", "updatedAt", "userId", "verifySsl") SELECT "authConfig", "authType", "baseUrl", "createdAt", "description", "followRedirects", "headers", "id", "name", "parentId", "postScript", "preScript", "proxy", "queryParams", "sortOrder", "timeout", "updatedAt", "userId", "verifySsl" FROM "Folder";
DROP TABLE "Folder";
ALTER TABLE "new_Folder" RENAME TO "Folder";
CREATE INDEX "Folder_parentId_idx" ON "Folder"("parentId");
CREATE INDEX "Folder_userId_idx" ON "Folder"("userId");
CREATE INDEX "Folder_groupId_idx" ON "Folder"("groupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Group_name_idx" ON "Group"("name");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_idx" ON "GroupMember"("groupId");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");
