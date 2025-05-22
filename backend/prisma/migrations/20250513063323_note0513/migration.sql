/*
  Warnings:

  - You are about to drop the column `notes` on the `Notebook` table. All the data in the column will be lost.
  - Added the required column `userId` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Folder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Note` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `NotePadNote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Notebook` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `SyncConfig` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "llmModel" TEXT DEFAULT 'default_llm',
    "llmApiKey" TEXT,
    "vectorizationModel" TEXT DEFAULT 'default_vector_model',
    "chunkSize" INTEGER DEFAULT 1000,
    "chunkOverlap" INTEGER DEFAULT 200,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "textContent" TEXT,
    "mimeType" TEXT,
    "textChunks" TEXT,
    "embeddings" JSONB,
    "statusMessage" TEXT,
    "fileSize" INTEGER NOT NULL,
    "filePath" TEXT,
    "isVectorized" BOOLEAN NOT NULL DEFAULT false,
    "notebookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Document_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("createdAt", "embeddings", "fileName", "filePath", "fileSize", "id", "isVectorized", "mimeType", "notebookId", "status", "statusMessage", "textChunks", "textContent", "updatedAt") SELECT "createdAt", "embeddings", "fileName", "filePath", "fileSize", "id", "isVectorized", "mimeType", "notebookId", "status", "statusMessage", "textChunks", "textContent", "updatedAt" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE INDEX "Document_notebookId_idx" ON "Document"("notebookId");
CREATE INDEX "Document_userId_idx" ON "Document"("userId");
CREATE TABLE "new_Folder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Folder" ("createdAt", "id", "name", "updatedAt") SELECT "createdAt", "id", "name", "updatedAt" FROM "Folder";
DROP TABLE "Folder";
ALTER TABLE "new_Folder" RENAME TO "Folder";
CREATE INDEX "Folder_userId_idx" ON "Folder"("userId");
CREATE TABLE "new_Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "contentJson" JSONB,
    "contentHtml" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "notebookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Note_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Note" ("contentHtml", "contentJson", "createdAt", "id", "notebookId", "title", "updatedAt") SELECT "contentHtml", "contentJson", "createdAt", "id", "notebookId", "title", "updatedAt" FROM "Note";
DROP TABLE "Note";
ALTER TABLE "new_Note" RENAME TO "Note";
CREATE INDEX "Note_notebookId_idx" ON "Note"("notebookId");
CREATE INDEX "Note_userId_idx" ON "Note"("userId");
CREATE TABLE "new_NotePadNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "content" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "notebookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "NotePadNote_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotePadNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NotePadNote" ("content", "createdAt", "id", "notebookId", "title", "updatedAt") SELECT "content", "createdAt", "id", "notebookId", "title", "updatedAt" FROM "NotePadNote";
DROP TABLE "NotePadNote";
ALTER TABLE "new_NotePadNote" RENAME TO "NotePadNote";
CREATE INDEX "NotePadNote_notebookId_idx" ON "NotePadNote"("notebookId");
CREATE INDEX "NotePadNote_userId_idx" ON "NotePadNote"("userId");
CREATE TABLE "new_Notebook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "folderId" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Notebook_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Notebook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Notebook" ("createdAt", "folderId", "id", "title", "updatedAt") SELECT "createdAt", "folderId", "id", "title", "updatedAt" FROM "Notebook";
DROP TABLE "Notebook";
ALTER TABLE "new_Notebook" RENAME TO "Notebook";
CREATE INDEX "Notebook_folderId_idx" ON "Notebook"("folderId");
CREATE INDEX "Notebook_userId_idx" ON "Notebook"("userId");
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
    "s3Acl" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "SyncConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SyncConfig" ("createdAt", "description", "id", "isActive", "name", "s3AccessKey", "s3Acl", "s3Bucket", "s3Endpoint", "s3Path", "s3Region", "s3SecretKey", "type", "updatedAt", "webdavPassword", "webdavPath", "webdavUrl", "webdavUsername") SELECT "createdAt", "description", "id", "isActive", "name", "s3AccessKey", "s3Acl", "s3Bucket", "s3Endpoint", "s3Path", "s3Region", "s3SecretKey", "type", "updatedAt", "webdavPassword", "webdavPath", "webdavUrl", "webdavUsername" FROM "SyncConfig";
DROP TABLE "SyncConfig";
ALTER TABLE "new_SyncConfig" RENAME TO "SyncConfig";
CREATE INDEX "SyncConfig_userId_idx" ON "SyncConfig"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
