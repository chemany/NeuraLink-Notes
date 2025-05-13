-- CreateTable
CREATE TABLE "SyncConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
