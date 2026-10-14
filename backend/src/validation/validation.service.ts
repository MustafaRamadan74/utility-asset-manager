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

    return {
      type: 'FeatureCollection',
      features,
    };
  }
}
