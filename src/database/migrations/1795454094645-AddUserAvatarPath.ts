import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAvatarPath1795454094645 implements MigrationInterface {
  name = 'AddUserAvatarPath1795454094645';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "avatarPath" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "avatarPath"`);
  }
}
