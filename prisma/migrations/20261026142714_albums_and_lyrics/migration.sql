-- CreateTable
CREATE TABLE "albums" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "releaseDate" TEXT NOT NULL,
    "artistId" INTEGER NOT NULL,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lyrics" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "songId" INTEGER NOT NULL,

    CONSTRAINT "lyrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "albums_artistId_idx" ON "albums"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "lyrics_songId_key" ON "lyrics"("songId");

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lyrics" ADD CONSTRAINT "lyrics_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
