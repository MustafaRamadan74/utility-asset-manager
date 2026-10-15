import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssetsTable1700000000000 implements MigrationInterface {
  name = 'CreateAssetsTable1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Enable PostGIS & pgcrypto extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // 2. Create ENUM types
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE asset_type AS ENUM ('PIPE', 'VALVE', 'HYDRANT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE asset_status AS ENUM ('ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 3. Create assets table with explicit NOT NULL columns and CHECK constraints
    await queryRunner.query(`
      CREATE TABLE assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type asset_type NOT NULL,
        name VARCHAR(255) NOT NULL,
        status asset_status NOT NULL DEFAULT 'ACTIVE',
        diameter_mm INTEGER,
        geom GEOMETRY(Geometry, 4326) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_name CHECK (length(btrim(name)) > 0),
        CONSTRAINT chk_geom_valid CHECK (NOT ST_IsEmpty(geom) AND ST_IsValid(geom)),
        CONSTRAINT chk_geom_type CHECK (
          (type = 'PIPE' AND GeometryType(geom) = 'LINESTRING') OR
          (type <> 'PIPE' AND GeometryType(geom) = 'POINT')
        ),
        CONSTRAINT chk_pipe_diameter CHECK (
          (type = 'PIPE' AND diameter_mm IS NOT NULL AND diameter_mm > 0) OR
          (type <> 'PIPE' AND diameter_mm IS NULL)
        )
      );
    `);

    // 4. Create GiST indexes (primary geometry index + expression geography index)
    await queryRunner.query(`
      CREATE INDEX idx_assets_geom ON assets USING GIST (geom);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_assets_geom_geography ON assets USING GIST (((geom::geography)));
    `);

    // 5. Automatic updated_at trigger
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_assets_updated_at
      BEFORE UPDATE ON assets
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_assets_updated_at ON assets;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column();`);
    await queryRunner.query(`DROP TABLE IF EXISTS assets;`);
    await queryRunner.query(`DROP TYPE IF EXISTS asset_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS asset_type;`);
  }
}
