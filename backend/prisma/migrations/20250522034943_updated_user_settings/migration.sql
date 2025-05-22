/*
  Warnings:

  - You are about to drop the column `chunkOverlap` on the `UserSettings` table. All the data in the column will be lost.
  - You are about to drop the column `chunkSize` on the `UserSettings` table. All the data in the column will be lost.
  - You are about to drop the column `llmApiKey` on the `UserSettings` table. All the data in the column will be lost.
  - You are about to drop the column `llmModel` on the `UserSettings` table. All the data in the column will be lost.
  - You are about to drop the column `vectorizationModel` on the `UserSettings` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "llmSettings" JSONB,
    "embeddingSettings" JSONB,
    "rerankingSettings" JSONB,
    "uiSettings" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserSettings" ("createdAt", "id", "updatedAt", "userId") SELECT "createdAt", "id", "updatedAt", "userId" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
