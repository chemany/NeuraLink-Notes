/*
  Warnings:

  - You are about to drop the column `isEnabled` on the `SyncConfig` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SyncConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "webdavUrl" TEXT,
    "webdavUsername" TEXT,
    "webdavPassword" TEXT,
    "webdavPath" TEXT,
    "s3Region" TEXT,
    "s3Bucket" TEXT,
    "s3AccessKey" TEXT,
    "s3SecretKey" TEXT,
    "s3Endpoint" TEXT,
    "s3Path" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SyncConfig" ("createdAt", "id", "name", "s3AccessKey", "s3Bucket", "s3Endpoint", "s3Path", "s3Region", "s3SecretKey", "type", "updatedAt", "webdavPassword", "webdavPath", "webdavUrl", "webdavUsername") SELECT "createdAt", "id", "name", "s3AccessKey", "s3Bucket", "s3Endpoint", "s3Path", "s3Region", "s3SecretKey", "type", "updatedAt", "webdavPassword", "webdavPath", "webdavUrl", "webdavUsername" FROM "SyncConfig";
DROP TABLE "SyncConfig";
ALTER TABLE "new_SyncConfig" RENAME TO "SyncConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
