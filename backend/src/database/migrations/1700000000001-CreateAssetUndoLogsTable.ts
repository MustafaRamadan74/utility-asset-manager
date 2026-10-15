import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssetUndoLogsTable1700000000001 implements MigrationInterface {
  name = 'CreateAssetUndoLogsTable1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS asset_undo_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action VARCHAR(20) NOT NULL,
        asset_id UUID NOT NULL,
        asset_name VARCHAR(255) NOT NULL,
        asset_type VARCHAR(50) NOT NULL,
        snapshot JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_asset_undo_logs_created_at
      ON asset_undo_logs (created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS asset_undo_logs;`);
  }
}
