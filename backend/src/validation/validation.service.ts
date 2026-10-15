import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ValidationFeature, ValidationReport } from './validation.types';

@Injectable()
export class ValidationService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Generates a GeoJSON FeatureCollection validation report (D4).
   * Runs two topological integrity rules implemented directly in PostGIS:
   * 1. VALVE_NOT_ON_PIPE (> 1 m from any pipe)
   * 2. DANGLING_PIPE_END (endpoint not within 1 m of another pipe, valve, or hydrant)
   */
  async getValidationReport(): Promise<ValidationReport> {
    const features: ValidationFeature[] = [];

    // Rule 1: VALVE_NOT_ON_PIPE
    const valveSql = `
      SELECT v.id, v.name, ST_AsGeoJSON(v.geom)::json AS geometry
      FROM assets v
      WHERE v.type = 'VALVE' AND NOT EXISTS (
        SELECT 1 FROM assets p
        WHERE p.type = 'PIPE'
        AND ST_DWithin(v.geom::geography, p.geom::geography, 1)
      );
    `;
    const invalidValves = await this.dataSource.query(valveSql);

    for (const v of invalidValves) {
      features.push({
        type: 'Feature',
        geometry: v.geometry,
        properties: {
          rule: 'VALVE_NOT_ON_PIPE',
          asset_ids: [v.id],
          message: `Valve "${v.name}" is more than 1 m from any pipe`,
        },
      });
    }

    // Rule 2: DANGLING_PIPE_END
    const danglingSql = `
      WITH ends AS (
        SELECT id, name, ST_StartPoint(geom) AS pt, 'start' AS which FROM assets WHERE type = 'PIPE'
        UNION ALL
        SELECT id, name, ST_EndPoint(geom),         'end'          FROM assets WHERE type = 'PIPE'
      )
      SELECT e.id, e.name, e.which, ST_AsGeoJSON(e.pt)::json AS geometry
      FROM ends e
      WHERE NOT EXISTS (
        SELECT 1 FROM assets o
        WHERE o.id <> e.id
        AND ST_DWithin(e.pt::geography, o.geom::geography, 1)
      );
    `;
    const danglingEnds = await this.dataSource.query(danglingSql);

    for (const d of danglingEnds) {
      features.push({
        type: 'Feature',
        geometry: d.geometry,
        properties: {
          rule: 'DANGLING_PIPE_END',
          asset_ids: [d.id],
          message: `Pipe "${d.name}" has an unconnected ${d.which}`,
        },
      });
    }

    // Rule 3: DUPLICATE_POINTS (same type within 0.5 m)
    const duplicatePointsSql = `
      SELECT a1.id AS id1, a1.name AS name1, a2.id AS id2, a2.name AS name2, a1.type,
             ST_AsGeoJSON(a1.geom)::json AS geometry,
             ROUND(ST_Distance(a1.geom::geography, a2.geom::geography)::numeric, 2) AS dist_m
      FROM assets a1
      JOIN assets a2 ON a1.type = a2.type AND a1.id < a2.id AND a1.type IN ('VALVE', 'HYDRANT')
      WHERE ST_DWithin(a1.geom::geography, a2.geom::geography, 0.5);
    `;
    const duplicatePoints = await this.dataSource.query(duplicatePointsSql);

    for (const dp of duplicatePoints) {
      features.push({
        type: 'Feature',
        geometry: dp.geometry,
        properties: {
          rule: 'DUPLICATE_POINTS',
          asset_ids: [dp.id1, dp.id2],
          message: `Duplicate ${dp.type} points: "${dp.name1}" and "${dp.name2}" within ${dp.dist_m}m of each other`,
        },
      });
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }
}
