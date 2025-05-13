/*
  Warnings:

  - You are about to drop the column `filePath` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `mimeType` on the `Document` table. All the data in the column will be lost.
  - You are about to alter the column `textChunks` on the `Document` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to drop the column `contentJson` on the `Note` table. All the data in the column will be lost.
  - You are about to drop the column `notebookId` on the `NotePadNote` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `NotePadNote` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Notebook` table. All the data in the column will be lost.
  - Added the required column `fileType` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimetype` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `s3Key` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Note` table without a default value. This is not possible if the table is not empty.
  - Made the column `title` on table `Note` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `height` to the `NotePadNote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `positionX` to the `NotePadNote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `positionY` to the `NotePadNote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `NotePadNote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `width` to the `NotePadNote` table without a default value. This is not possible if the table is not empty.
  - Made the column `content` on table `NotePadNote` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `userId` to the `Notebook` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "statusMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "textContent" TEXT,
    "isVectorized" BOOLEAN DEFAULT false,
    "textChunks" JSONB,
    "embeddings" JSONB,
    "notebookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Document_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("createdAt", "embeddings", "fileName", "fileSize", "id", "notebookId", "status", "statusMessage", "textChunks", "textContent", "updatedAt") SELECT "createdAt", "embeddings", "fileName", "fileSize", "id", "notebookId", "status", "statusMessage", "textChunks", "textContent", "updatedAt" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE UNIQUE INDEX "Document_s3Key_key" ON "Document"("s3Key");
CREATE INDEX "Document_notebookId_idx" ON "Document"("notebookId");
CREATE INDEX "Document_userId_idx" ON "Document"("userId");
CREATE TABLE "new_Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "contentHtml" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "notebookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Note_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Note" ("contentHtml", "createdAt", "id", "notebookId", "title", "updatedAt") SELECT "contentHtml", "createdAt", "id", "notebookId", "title", "updatedAt" FROM "Note";
DROP TABLE "Note";
ALTER TABLE "new_Note" RENAME TO "Note";
CREATE INDEX "Note_notebookId_idx" ON "Note"("notebookId");
CREATE INDEX "Note_userId_idx" ON "Note"("userId");
CREATE TABLE "new_NotePadNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "positionX" REAL NOT NULL,
    "positionY" REAL NOT NULL,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "NotePadNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NotePadNote" ("content", "createdAt", "id", "updatedAt") SELECT "content", "createdAt", "id", "updatedAt" FROM "NotePadNote";
DROP TABLE "NotePadNote";
ALTER TABLE "new_NotePadNote" RENAME TO "NotePadNote";
CREATE INDEX "NotePadNote_userId_idx" ON "NotePadNote"("userId");
CREATE TABLE "new_Notebook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "folderId" TEXT,
    CONSTRAINT "Notebook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notebook_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Notebook" ("createdAt", "folderId", "id", "title", "updatedAt") SELECT "createdAt", "folderId", "id", "title", "updatedAt" FROM "Notebook";
DROP TABLE "Notebook";
ALTER TABLE "new_Notebook" RENAME TO "Notebook";
CREATE INDEX "Notebook_folderId_idx" ON "Notebook"("folderId");
CREATE INDEX "Notebook_userId_idx" ON "Notebook"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
