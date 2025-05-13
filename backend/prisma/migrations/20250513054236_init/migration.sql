/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `fileType` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `mimetype` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `s3Key` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `Note` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Note` table. All the data in the column will be lost.
  - You are about to drop the column `color` on the `NotePadNote` table. All the data in the column will be lost.
  - You are about to drop the column `height` on the `NotePadNote` table. All the data in the column will be lost.
  - You are about to drop the column `positionX` on the `NotePadNote` table. All the data in the column will be lost.
  - You are about to drop the column `positionY` on the `NotePadNote` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `NotePadNote` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `NotePadNote` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Notebook` table. All the data in the column will be lost.
  - Added the required column `notebookId` to the `NotePadNote` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "User_email_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "User";
PRAGMA foreign_keys=on;

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
    CONSTRAINT "Document_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("createdAt", "embeddings", "fileName", "filePath", "fileSize", "id", "isVectorized", "notebookId", "status", "statusMessage", "textChunks", "textContent", "updatedAt") SELECT "createdAt", "embeddings", "fileName", "filePath", "fileSize", "id", "isVectorized", "notebookId", "status", "statusMessage", "textChunks", "textContent", "updatedAt" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE INDEX "Document_notebookId_idx" ON "Document"("notebookId");
CREATE TABLE "new_Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "contentJson" JSONB,
    "contentHtml" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "notebookId" TEXT NOT NULL,
    CONSTRAINT "Note_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Note" ("contentHtml", "createdAt", "id", "notebookId", "title", "updatedAt") SELECT "contentHtml", "createdAt", "id", "notebookId", "title", "updatedAt" FROM "Note";
DROP TABLE "Note";
ALTER TABLE "new_Note" RENAME TO "Note";
CREATE INDEX "Note_notebookId_idx" ON "Note"("notebookId");
CREATE TABLE "new_NotePadNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "content" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "notebookId" TEXT NOT NULL
);
INSERT INTO "new_NotePadNote" ("content", "createdAt", "id", "updatedAt") SELECT "content", "createdAt", "id", "updatedAt" FROM "NotePadNote";
DROP TABLE "NotePadNote";
ALTER TABLE "new_NotePadNote" RENAME TO "NotePadNote";
CREATE INDEX "NotePadNote_notebookId_idx" ON "NotePadNote"("notebookId");
CREATE TABLE "new_Notebook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "notes" TEXT,
    "folderId" TEXT,
    CONSTRAINT "Notebook_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Notebook" ("createdAt", "folderId", "id", "title", "updatedAt") SELECT "createdAt", "folderId", "id", "title", "updatedAt" FROM "Notebook";
DROP TABLE "Notebook";
ALTER TABLE "new_Notebook" RENAME TO "Notebook";
CREATE INDEX "Notebook_folderId_idx" ON "Notebook"("folderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
