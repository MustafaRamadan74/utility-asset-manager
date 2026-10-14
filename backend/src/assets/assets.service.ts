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
import { validateAssetGeometry, validatePolygonGeometry } from './geometry.util';

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
      throw new BadRequestException([
        `Database constraint violation: ${error.constraint || 'check constraint failed'}`,
      ]);
    }
    if (error?.code === '23502') {
      throw new BadRequestException([
        `Missing required column: ${error.column || 'not null constraint failed'}`,
      ]);
    }
    if (error?.code === '22P02') {
      throw new BadRequestException(['Invalid parameter format']);
    }
    throw error;
  }

  /**
   * Create a new asset (PIPE, VALVE, or HYDRANT).
   */
  async create(createDto: CreateAssetDto): Promise<Asset> {
    validateAssetGeometry(createDto.type, createDto.geometry);

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
   * List assets with optional filtering by type, status, and bbox (D4).
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

    // bbox validation: minX,minY,maxX,maxY
    if (query.bbox) {
      const parts = query.bbox.split(',').map((p) => parseFloat(p.trim()));
      if (
        parts.length !== 4 ||
        parts.some((n) => isNaN(n) || !Number.isFinite(n))
      ) {
        throw new BadRequestException([
          'bbox must contain 4 valid numbers separated by commas: minX,minY,maxX,maxY',
        ]);
      }

      const [minX, minY, maxX, maxY] = parts;
      if (minX > maxX || minY > maxY) {
        throw new BadRequestException([
          'Invalid bbox ranges: minX must be <= maxX and minY must be <= maxY',
        ]);
      }
      if (minX < -180 || maxX > 180 || minY < -90 || maxY > 90) {
        throw new BadRequestException([
          'bbox coordinates out of bounds: longitude must be in [-180, 180], latitude in [-90, 90]',
        ]);
      }

      params.push(minX, minY, maxX, maxY);
      const idx = params.length - 3;
      conditions.push(
        `ST_Intersects(geom, ST_MakeEnvelope($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, 4326))`,
      );
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
   * Find assets intersecting a GeoJSON Polygon (D4).
   * Uses ST_MakeValid to guard against self-intersecting polygons.
   */
  async findWithin(polygon: any): Promise<Asset[]> {
    validatePolygonGeometry(polygon);

    const sql = `
      SELECT ${ASSET_COLUMNS}
      FROM assets
      WHERE ST_Intersects(geom, ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)))
      LIMIT 5000;
    `;

    return this.dataSource.query(sql, [JSON.stringify(polygon)]);
  }

  /**
   * Find nearest assets using KNN operator (<->) and exact geodesic distance in metres (D4).
   */
  async findNearest(
    lng: number,
    lat: number,
    limit: number = 5,
  ): Promise<(Asset & { distance_m: number })[]> {
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new BadRequestException([
        'Coordinates out of bounds: lng in [-180, 180], lat in [-90, 90]',
      ]);
    }

    const effectiveLimit = Math.max(1, Math.min(50, limit || 5));

    const sql = `
      WITH p AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g)
      SELECT * FROM (
        SELECT ${ASSET_COLUMNS}, ROUND(ST_Distance(a.geom::geography, p.g)::numeric, 2)::float AS distance_m
        FROM assets a, p
        ORDER BY a.geom::geography <-> p.g
        LIMIT $3 * 3
      ) c ORDER BY distance_m LIMIT $3;
    `;

    return this.dataSource.query(sql, [lng, lat, effectiveLimit]);
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
    const existing = await this.findOne(id);

    if ((updateDto as any).type !== undefined) {
      throw new BadRequestException(['Asset type is immutable after creation']);
    }

    const mergedName =
      updateDto.name !== undefined ? updateDto.name : existing.name;
    const mergedStatus =
      updateDto.status !== undefined ? updateDto.status : existing.status;
    const mergedDiameter =
      updateDto.diameter_mm !== undefined
        ? updateDto.diameter_mm
        : existing.diameter_mm;

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

    let geomParam: string | null = null;
    if (updateDto.geometry !== undefined) {
      validateAssetGeometry(existing.type, updateDto.geometry);
      geomParam = JSON.stringify(updateDto.geometry);
    }

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
    await this.findOne(id);
    await this.dataSource.query('DELETE FROM assets WHERE id = $1;', [id]);
    return { deleted: true, id };
  }
}
