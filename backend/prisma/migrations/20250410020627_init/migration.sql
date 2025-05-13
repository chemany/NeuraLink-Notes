/*
  Warnings:

  - Added the required column `filePath` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
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
    "filePath" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    CONSTRAINT "Document_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("createdAt", "embeddings", "fileName", "fileSize", "id", "mimeType", "notebookId", "status", "statusMessage", "textChunks", "textContent", "updatedAt") SELECT "createdAt", "embeddings", "fileName", "fileSize", "id", "mimeType", "notebookId", "status", "statusMessage", "textChunks", "textContent", "updatedAt" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE INDEX "Document_notebookId_idx" ON "Document"("notebookId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
