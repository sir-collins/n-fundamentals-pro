import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastTotpStep1791582554249 implements MigrationInterface {
  name = 'AddLastTotpStep1791582554249';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "lastTotpStep" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "lastTotpStep"`);
  }
}
