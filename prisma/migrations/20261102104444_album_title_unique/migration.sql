-- DropIndex
DROP INDEX "albums_artistId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "albums_artistId_title_key" ON "albums"("artistId", "title");

