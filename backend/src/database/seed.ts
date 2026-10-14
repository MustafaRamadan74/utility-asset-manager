/**
 * Utility Asset Manager - Seed Script
 * 
 * Target Area: New Administrative Capital, Egypt (around lng 31.760, lat 30.020)
 * Total Assets: 30 (8 Pipes, 11 Valves, 11 Hydrants)
 * Statuses: Active, Maintenance, Decommissioned
 * 
 * DELIBERATE TOPOLOGICAL ERRORS (EXACTLY 4):
 * 1. Rule: VALVE_NOT_ON_PIPE
 *    Asset: Valve "V-ERR-01"
 *    Location: [31.761000, 30.020045] (~5 metres north of Pipe P-01)
 *    Message: Valve "V-ERR-01" is more than 1 m from any pipe
 * 
 * 2. Rule: VALVE_NOT_ON_PIPE
 *    Asset: Valve "V-ERR-02"
 *    Location: [31.763000, 30.019639] (~40 metres south of Pipe P-02)
 *    Message: Valve "V-ERR-02" is more than 1 m from any pipe
 * 
 * 3. Rule: DANGLING_PIPE_END
 *    Asset: Pipe "P-04" (start end)
 *    Location: [31.758000, 30.022000] (Uncapped and unconnected start point)
 *    Message: Pipe "P-04" has an unconnected start
 * 
 * 4. Rule: DANGLING_PIPE_END
 *    Asset: Pipe "P-07" (end end)
 *    Location: [31.765500, 30.023500] (Uncapped and unconnected end point)
 *    Message: Pipe "P-07" has an unconnected end
 */

import AppDataSource from '../config/data-source';

interface AssetSeed {
  name: string;
  type: 'PIPE' | 'VALVE' | 'HYDRANT';
  status: 'ACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED';
  diameter_mm: number | null;
  geojson: object;
}

// Coordinate Junctions (Snapping Nodes)
const N0 = [31.760000, 30.020000]; // P1 Start (capped by V-01)
const N1_MID = [31.761000, 30.020000]; // On P1 (V-06, H-02 nearby on vertex)
const N1 = [31.762000, 30.020000]; // P1 End / P2 Start / P5 Start (V-02 at junction)
const N2_MID = [31.763000, 30.020000]; // On P2 (V-07 on vertex)
const N2 = [31.764000, 30.020000]; // P2 End / P3 Start / P8 Start (V-03 at junction)
const N3_MID = [31.765000, 30.020000]; // On P3 (H-03 on vertex)
const N3 = [31.766000, 30.020000]; // P3 End (capped by H-01)

const N10 = [31.758000, 30.022000]; // P4 Dangling Start (Deliberate Error 3)
const N4_MID = [31.760000, 30.022000]; // On P4 (V-08 on vertex)
const N5 = [31.762000, 30.022000]; // P4 End / P5 End / P6 Start (V-04 at junction)

const N6 = [31.764000, 30.022000]; // P6 End / P8 End / P7 Start (V-05 at junction)
const N11 = [31.765500, 30.023500]; // P7 Dangling End (Deliberate Error 4)

// 8 Pipes
const pipes: AssetSeed[] = [
  {
    name: 'P-01',
    type: 'PIPE',
    status: 'ACTIVE',
    diameter_mm: 300,
    geojson: { type: 'LineString', coordinates: [N0, N1_MID, N1] },
  },
  {
    name: 'P-02',
    type: 'PIPE',
    status: 'ACTIVE',
    diameter_mm: 300,
    geojson: { type: 'LineString', coordinates: [N1, N2_MID, N2] },
  },
  {
    name: 'P-03',
    type: 'PIPE',
    status: 'ACTIVE',
    diameter_mm: 200,
    geojson: { type: 'LineString', coordinates: [N2, N3_MID, N3] },
  },
  {
    name: 'P-04',
    type: 'PIPE',
    status: 'MAINTENANCE',
    diameter_mm: 150,
    // N10 is unconnected & uncapped -> Dangling Start Error
    geojson: { type: 'LineString', coordinates: [N10, N4_MID, N5] },
  },
  {
    name: 'P-05',
    type: 'PIPE',
    status: 'ACTIVE',
    diameter_mm: 200,
    geojson: { type: 'LineString', coordinates: [N1, N5] },
  },
  {
    name: 'P-06',
    type: 'PIPE',
    status: 'ACTIVE',
    diameter_mm: 150,
    geojson: { type: 'LineString', coordinates: [N5, N6] },
  },
  {
    name: 'P-07',
    type: 'PIPE',
    status: 'DECOMMISSIONED',
    diameter_mm: 100,
    // N11 is unconnected & uncapped -> Dangling End Error
    geojson: { type: 'LineString', coordinates: [N6, N11] },
  },
  {
    name: 'P-08',
    type: 'PIPE',
    status: 'ACTIVE',
    diameter_mm: 200,
    geojson: { type: 'LineString', coordinates: [N2, N6] },
  },
];

// 11 Valves (9 valid, exactly snapped to pipe endpoints or vertices + 2 deliberate errors)
const valves: AssetSeed[] = [
  {
    name: 'V-01',
    type: 'VALVE',
    status: 'ACTIVE',
    diameter_mm: null,
    geojson: { type: 'Point', coordinates: N0 }, // Caps P-01 start
  },
  {
    name: 'V-02',
    type: 'VALVE',
    status: 'ACTIVE',
    diameter_mm: null,
    geojson: { type: 'Point', coordinates: N1 }, // Junction P1-P2-P5
  },
  {
    name: 'V-03',
    type: 'VALVE',
    status: 'ACTIVE',
    diameter_mm: null,
    geojson: { type: 'Point', coordinates: N2 }, // Junction P2-P3-P8
  },
  {
    name: 'V-04',
    type: 'VALVE',
    status: 'ACTIVE',
    diameter_mm: null,
    geojson: { type: 'Point', coordinates: N5 }, // Junction P4-P5-P6
  },
  {
    name: 'V-05',
    type: 'VALVE',
    status: 'ACTIVE',
    diameter_mm: null,
    geojson: { type: 'Point', coordinates: N6 }, // Junction P6-P7-P8
  },
  {
    name: 'V-06',
    type: 'VALVE',
    status: 'MAINTENANCE',
    diameter_mm: null,
    geojson: { type: 'Point', coordinates: N1_MID }, // Vertex on P-01
  },
  {
    name: 'V-07',
    type: 'VALVE',
    status: 'ACTIVE',
    diameter_mm: null,
    geojson: { type: 'Point', coordinates: N2_MID }, // Vertex on P-02
  },
  {
    name: 'V-08',
    type: 'VALVE',
    status: 'ACTIVE',
    diameter_mm: null,
    geojson: { type: 'Point', coordinates: N4_MID }, // Vertex on P-04
  },
  {
    name: 'V-09',
    type: 'VALVE',
    status: 'DECOMMISSIONED',
    diameter_mm: null,
    // Midpoint on P-05 [ (31.762, 30.020) + (31.762, 30.022) ] / 2 = (31.762, 30.021)
    geojson: { type: 'Point', coordinates: [31.762000, 30.021000] },
  },
  // --- Deliberate Errors (2 misplaced valves) ---
  {
    name: 'V-ERR-01',
    type: 'VALVE',
    status: 'ACTIVE',
    diameter_mm: null,
    // ~5m North of N1_MID (lat + 0.000045) -> Deliberate Error 1
    geojson: { type: 'Point', coordinates: [31.761000, 30.020045] },
  },
  {
    name: 'V-ERR-02',
    type: 'VALVE',
    status: 'ACTIVE',
    diameter_mm: null,
    // ~40m South of N2_MID (lat - 0.000361) -> Deliberate Error 2
    geojson: { type: 'Point', coordinates: [31.763000, 30.019639] },
  },
];

// 11 Hydrants (All valid, snapped to endpoints or along pipes)
const hydrants: AssetSeed[] = [
  {
    name: 'H-01',
    type: 'HYDRANT',
    status: 'ACTIVE',
    diameter_mm: null,
    geojson: { type: 'Point', coordinates: N3 }, // Caps P-03 end
  },
  {
    name: 'H-02',
    type: 'HYDRANT',
    status: 'ACTIVE',
    diameter_mm: null,
    geojson: { type: 'Point', coordinates: N3_MID }, // Vertex on P-03
  },
  {
    name: 'H-03',
    type: 'HYDRANT',
    status: 'ACTIVE',
    diameter_mm: null,
    // Along P-01 at quarter length [31.760500, 30.020000]
    geojson: { type: 'Point', coordinates: [31.760500, 30.020000] },
  },
  {
    name: 'H-04',
    type: 'HYDRANT',
    status: 'ACTIVE',
    diameter_mm: null,
    // Along P-01 at three-quarter length [31.761500, 30.020000]
    geojson: { type: 'Point', coordinates: [31.761500, 30.020000] },
  },
  {
    name: 'H-05',
    type: 'HYDRANT',
    status: 'ACTIVE',
    diameter_mm: null,
    // Along P-02 [31.762500, 30.020000]
    geojson: { type: 'Point', coordinates: [31.762500, 30.020000] },
  },
  {
    name: 'H-06',
    type: 'HYDRANT',
    status: 'ACTIVE',
    diameter_mm: null,
    // Along P-02 [31.763500, 30.020000]
    geojson: { type: 'Point', coordinates: [31.763500, 30.020000] },
  },
  {
    name: 'H-07',
    type: 'HYDRANT',
    status: 'MAINTENANCE',
    diameter_mm: null,
    // Along P-06 mid [31.763000, 30.022000]
    geojson: { type: 'Point', coordinates: [31.763000, 30.022000] },
  },
  {
    name: 'H-08',
    type: 'HYDRANT',
    status: 'ACTIVE',
    diameter_mm: null,
    // Along P-08 mid [31.764000, 30.021000]
    geojson: { type: 'Point', coordinates: [31.764000, 30.021000] },
  },
  {
    name: 'H-09',
    type: 'HYDRANT',
    status: 'ACTIVE',
    diameter_mm: null,
    // Along P-04 between N10 and N4_MID [31.759000, 30.022000]
    geojson: { type: 'Point', coordinates: [31.759000, 30.022000] },
  },
  {
    name: 'H-10',
    type: 'HYDRANT',
    status: 'DECOMMISSIONED',
    diameter_mm: null,
    // Along P-04 between N4_MID and N5 [31.761000, 30.022000]
    geojson: { type: 'Point', coordinates: [31.761000, 30.022000] },
  },
  {
    name: 'H-11',
    type: 'HYDRANT',
    status: 'ACTIVE',
    diameter_mm: null,
    // Along P-07 near N6 [31.764500, 30.022500]
    geojson: { type: 'Point', coordinates: [31.764500, 30.022500] },
  },
];

async function seed() {
  console.log('--- Initializing Utility Asset Database Seed ---');
  await AppDataSource.initialize();

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. Clear existing assets (Idempotency)
    console.log('Clearing existing assets...');
    await queryRunner.query('DELETE FROM assets;');

    const allAssets: AssetSeed[] = [...pipes, ...valves, ...hydrants];
    console.log(`Inserting ${allAssets.length} assets...`);

    for (const asset of allAssets) {
      await queryRunner.query(
        `INSERT INTO assets (name, type, status, diameter_mm, geom)
         VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326));`,
        [
          asset.name,
          asset.type,
          asset.status,
          asset.diameter_mm,
          JSON.stringify(asset.geojson),
        ]
      );
    }

    await queryRunner.commitTransaction();
    console.log(`Successfully seeded ${allAssets.length} assets!`);

    const countResult = await queryRunner.query('SELECT count(*) FROM assets;');
    console.log(`Total assets in database: ${countResult[0].count}`);
  } catch (error) {
    console.error('Seeding failed, rolling back transaction:', error);
    await queryRunner.rollbackTransaction();
    process.exit(1);
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
