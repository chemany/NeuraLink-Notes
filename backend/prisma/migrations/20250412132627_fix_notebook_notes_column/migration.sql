-- AlterTable
ALTER TABLE "Notebook" ADD COLUMN "notes" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NotePadNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "content" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "notebookId" TEXT NOT NULL
);
INSERT INTO "new_NotePadNote" ("content", "createdAt", "id", "notebookId", "title", "updatedAt") SELECT "content", "createdAt", "id", "notebookId", "title", "updatedAt" FROM "NotePadNote";
DROP TABLE "NotePadNote";
ALTER TABLE "new_NotePadNote" RENAME TO "NotePadNote";
CREATE INDEX "NotePadNote_notebookId_idx" ON "NotePadNote"("notebookId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
