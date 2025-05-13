/*
  Warnings:

  - Made the column `embeddings` on table `Document` required. This step will fail if there are existing NULL values in that column.
  - Made the column `statusMessage` on table `Document` required. This step will fail if there are existing NULL values in that column.
  - Made the column `textChunks` on table `Document` required. This step will fail if there are existing NULL values in that column.
  - Made the column `textContent` on table `Document` required. This step will fail if there are existing NULL values in that column.
  - Made the column `content` on table `Note` required. This step will fail if there are existing NULL values in that column.
  - Made the column `contentHtml` on table `Note` required. This step will fail if there are existing NULL values in that column.
  - Made the column `color` on table `NotePadNote` required. This step will fail if there are existing NULL values in that column.
  - Made the column `folderId` on table `Notebook` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL DEFAULT 'unknown',
    "fileType" TEXT NOT NULL DEFAULT 'unknown',
    "fileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "statusMessage" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "textContent" TEXT NOT NULL,
    "isVectorized" BOOLEAN NOT NULL DEFAULT false,
    "textChunks" JSONB NOT NULL,
    "embeddings" JSONB NOT NULL,
    "notebookId" TEXT NOT NULL,
    "userId" TEXT,
    CONSTRAINT "Document_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("createdAt", "embeddings", "fileName", "fileSize", "fileType", "id", "isVectorized", "mimetype", "notebookId", "s3Key", "status", "statusMessage", "textChunks", "textContent", "updatedAt", "userId") SELECT "createdAt", "embeddings", "fileName", "fileSize", "fileType", "id", coalesce("isVectorized", false) AS "isVectorized", "mimetype", "notebookId", "s3Key", "status", "statusMessage", "textChunks", "textContent", "updatedAt", "userId" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE UNIQUE INDEX "Document_s3Key_key" ON "Document"("s3Key");
CREATE INDEX "Document_notebookId_idx" ON "Document"("notebookId");
CREATE INDEX "Document_userId_idx" ON "Document"("userId");
CREATE TABLE "new_Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "notebookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Note_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Note" ("content", "contentHtml", "createdAt", "id", "notebookId", "title", "updatedAt", "userId") SELECT "content", "contentHtml", "createdAt", "id", "notebookId", "title", "updatedAt", "userId" FROM "Note";
DROP TABLE "Note";
ALTER TABLE "new_Note" RENAME TO "Note";
CREATE INDEX "Note_notebookId_idx" ON "Note"("notebookId");
CREATE INDEX "Note_userId_idx" ON "Note"("userId");
CREATE TABLE "new_NotePadNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "positionX" REAL NOT NULL DEFAULT 0.0,
    "positionY" REAL NOT NULL DEFAULT 0.0,
    "width" REAL NOT NULL DEFAULT 0.0,
    "height" REAL NOT NULL DEFAULT 0.0,
    "color" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "NotePadNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NotePadNote" ("color", "content", "createdAt", "height", "id", "positionX", "positionY", "updatedAt", "userId", "width") SELECT "color", "content", "createdAt", "height", "id", "positionX", "positionY", "updatedAt", "userId", "width" FROM "NotePadNote";
DROP TABLE "NotePadNote";
ALTER TABLE "new_NotePadNote" RENAME TO "NotePadNote";
CREATE INDEX "NotePadNote_userId_idx" ON "NotePadNote"("userId");
CREATE TABLE "new_Notebook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    CONSTRAINT "Notebook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notebook_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Notebook" ("createdAt", "folderId", "id", "title", "updatedAt", "userId") SELECT "createdAt", "folderId", "id", "title", "updatedAt", "userId" FROM "Notebook";
DROP TABLE "Notebook";
ALTER TABLE "new_Notebook" RENAME TO "Notebook";
CREATE INDEX "Notebook_folderId_idx" ON "Notebook"("folderId");
CREATE INDEX "Notebook_userId_idx" ON "Notebook"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
