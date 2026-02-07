-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EnvironmentVariable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'string',
    "scope" TEXT NOT NULL DEFAULT 'global',
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL DEFAULT 'input',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "environmentId" TEXT NOT NULL,
    CONSTRAINT "EnvironmentVariable_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EnvironmentVariable" ("description", "environmentId", "id", "isSecret", "key", "scope", "sortOrder", "type", "value") SELECT "description", "environmentId", "id", "isSecret", "key", "scope", "sortOrder", "type", "value" FROM "EnvironmentVariable";
DROP TABLE "EnvironmentVariable";
ALTER TABLE "new_EnvironmentVariable" RENAME TO "EnvironmentVariable";
CREATE INDEX "EnvironmentVariable_environmentId_idx" ON "EnvironmentVariable"("environmentId");
CREATE UNIQUE INDEX "EnvironmentVariable_environmentId_key_scope_key" ON "EnvironmentVariable"("environmentId", "key", "scope");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
