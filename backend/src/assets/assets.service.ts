import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Asset, AssetStatus, AssetType } from './asset.types';
import { ASSET_COLUMNS } from './assets.sql';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { ListAssetsQueryDto } from './dto/list-assets-query.dto';
import { validateAssetGeometry } from './geometry.util';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AssetsService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Helper to execute queries and map database constraint errors to 400 (D5).
   */
  private handleDatabaseError(error: any): never {
    if (error?.code === '23514') {
      // CHECK constraint violation
      throw new BadRequestException([
        `Database constraint violation: ${error.constraint || 'check constraint failed'}`,
      ]);
    }
    if (error?.code === '23502') {
      // NOT NULL constraint violation
      throw new BadRequestException([
        `Missing required column: ${error.column || 'not null constraint failed'}`,
      ]);
    }
    if (error?.code === '22P02') {
      // Invalid syntax (e.g. invalid UUID)
      throw new BadRequestException(['Invalid parameter format']);
    }
    throw error;
  }

  /**
   * Create a new asset (PIPE, VALVE, or HYDRANT).
   */
  async create(createDto: CreateAssetDto): Promise<Asset> {
    // 1. Validate geometry structure & coordinates against asset type (D6)
    validateAssetGeometry(createDto.type, createDto.geometry);

    // 2. Insert via raw SQL with parameters
    const sql = `
      INSERT INTO assets (name, type, status, diameter_mm, geom)
      VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326))
      RETURNING ${ASSET_COLUMNS};
    `;

    try {
      const result = await this.dataSource.query(sql, [
        createDto.name,
        createDto.type,
        createDto.status || AssetStatus.ACTIVE,
        createDto.diameter_mm ?? null,
        JSON.stringify(createDto.geometry),
      ]);
      return result[0];
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  /**
   * List assets with optional filtering by type, status, and bbox.
   */
  async findAll(query: ListAssetsQueryDto): Promise<Asset[]> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (query.type) {
      params.push(query.type);
      conditions.push(`type = $${params.length}`);
    }

    if (query.status) {
      params.push(query.status);
      conditions.push(`status = $${params.length}`);
    }

    // bbox filter: minX,minY,maxX,maxY
    if (query.bbox) {
      const parts = query.bbox.split(',').map((p) => parseFloat(p.trim()));
      if (
        parts.length === 4 &&
        parts.every((n) => !isNaN(n) && Number.isFinite(n))
      ) {
        const [minX, minY, maxX, maxY] = parts;
        if (minX <= maxX && minY <= maxY) {
          params.push(minX, minY, maxX, maxY);
          const idx = params.length - 3;
          conditions.push(
            `ST_Intersects(geom, ST_MakeEnvelope($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, 4326))`,
          );
        }
      }
    }

    const sql = `
      SELECT ${ASSET_COLUMNS}
      FROM assets
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT 5000;
    `;

    return this.dataSource.query(sql, params);
  }

  /**
   * Get single asset by UUID.
   */
  async findOne(id: string): Promise<Asset> {
    if (!UUID_REGEX.test(id)) {
      throw new NotFoundException(`Asset with id '${id}' not found`);
    }

    const sql = `SELECT ${ASSET_COLUMNS} FROM assets WHERE id = $1;`;
    const rows = await this.dataSource.query(sql, [id]);

    if (!rows || rows.length === 0) {
      throw new NotFoundException(`Asset with id '${id}' not found`);
    }

    return rows[0];
  }

  /**
   * Update an asset (D5 merge and re-validate rule).
   */
  async update(id: string, updateDto: UpdateAssetDto): Promise<Asset> {
    // 1. Load existing asset
    const existing = await this.findOne(id);

    // 2. Reject type mutation if attempted
    if ((updateDto as any).type !== undefined) {
      throw new BadRequestException(['Asset type is immutable after creation']);
    }

    // 3. Merge state
    const mergedName =
      updateDto.name !== undefined ? updateDto.name : existing.name;
    const mergedStatus =
      updateDto.status !== undefined ? updateDto.status : existing.status;
    const mergedDiameter =
      updateDto.diameter_mm !== undefined
        ? updateDto.diameter_mm
        : existing.diameter_mm;

    // 4. Re-validate final state against existing asset type (D5)
    if (existing.type === AssetType.PIPE) {
      if (
        mergedDiameter === null ||
        mergedDiameter === undefined ||
        mergedDiameter <= 0
      ) {
        throw new BadRequestException([
          'diameter_mm is required and must be greater than 0 for PIPE assets',
        ]);
      }
    } else {
      if (mergedDiameter !== null && mergedDiameter !== undefined) {
        throw new BadRequestException([
          'diameter_mm is only allowed for PIPE assets and must not be provided for VALVE or HYDRANT',
        ]);
      }
    }

    // 5. If geometry is provided, validate against existing type
    let geomParam: string | null = null;
    if (updateDto.geometry !== undefined) {
      validateAssetGeometry(existing.type, updateDto.geometry);
      geomParam = JSON.stringify(updateDto.geometry);
    }

    // 6. Execute parameterized update
    const sql = `
      UPDATE assets
      SET
        name = $1,
        status = $2,
        diameter_mm = $3,
        geom = CASE WHEN $4::text IS NOT NULL THEN ST_SetSRID(ST_GeomFromGeoJSON($4), 4326) ELSE geom END
      WHERE id = $5
      RETURNING ${ASSET_COLUMNS};
    `;

    try {
      const result = await this.dataSource.query(sql, [
        mergedName,
        mergedStatus,
        mergedDiameter ?? null,
        geomParam,
        id,
      ]);
      return result[0];
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  /**
   * Delete an asset by UUID.
   */
  async remove(id: string): Promise<{ deleted: boolean; id: string }> {
    // Check existence (throws 404 if not found)
    await this.findOne(id);

    await this.dataSource.query('DELETE FROM assets WHERE id = $1;', [id]);
    return { deleted: true, id };
  }
}
