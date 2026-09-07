import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1788756684733 implements MigrationInterface {
  name = 'InitialSchema1788756684733';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "artist" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_dd5a88442cd2e068463fa03e496" UNIQUE ("name"), CONSTRAINT "PK_55b76e71568b5db4d01d3e394ed" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "song" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "releaseDate" character varying NOT NULL, "duration" character varying NOT NULL, CONSTRAINT "PK_baaa977f861cce6ff954ccee285" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_role_enum" AS ENUM('user', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "role" "public"."user_role_enum" NOT NULL DEFAULT 'user', "twoFactorSecret" character varying, "isTwoFactorEnabled" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "api_key" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "hashedKey" character varying NOT NULL, "label" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "lastUsedAt" TIMESTAMP, CONSTRAINT "UQ_4818b307a1eb91c1e041adfbc34" UNIQUE ("hashedKey"), CONSTRAINT "PK_b1bd840641b8acbaad89c3d8d11" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "song_artists_artist" ("songId" integer NOT NULL, "artistId" integer NOT NULL, CONSTRAINT "PK_38fe81fb5fd7ff1e938ab214522" PRIMARY KEY ("songId", "artistId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_444e236ce5cc51e9117fdc4b5b" ON "song_artists_artist"  ("songId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_94917f0a503ce27772bae20e43" ON "song_artists_artist"  ("artistId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "song_artists_artist" ADD CONSTRAINT "FK_444e236ce5cc51e9117fdc4b5b2" FOREIGN KEY ("songId") REFERENCES "song"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "song_artists_artist" ADD CONSTRAINT "FK_94917f0a503ce27772bae20e430" FOREIGN KEY ("artistId") REFERENCES "artist"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "song_artists_artist" DROP CONSTRAINT "FK_94917f0a503ce27772bae20e430"`,
    );
    await queryRunner.query(
      `ALTER TABLE "song_artists_artist" DROP CONSTRAINT "FK_444e236ce5cc51e9117fdc4b5b2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_94917f0a503ce27772bae20e43"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_444e236ce5cc51e9117fdc4b5b"`,
    );
    await queryRunner.query(`DROP TABLE "song_artists_artist"`);
    await queryRunner.query(`DROP TABLE "api_key"`);
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
    await queryRunner.query(`DROP TABLE "song"`);
    await queryRunner.query(`DROP TABLE "artist"`);
  }
}
