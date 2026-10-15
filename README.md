# Utility Asset Manager 🚰🗺️

[![PostGIS](https://img.shields.io/badge/PostGIS-3.4-blue.svg)](https://postgis.net/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red.svg)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-13.5-black.svg)](https://nextjs.org/)
[![ArcGIS Maps SDK](https://img.shields.io/badge/ArcGIS%20Maps%20SDK-4.29-007ac2.svg)](https://developers.arcgis.com/javascript/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ed.svg)](https://www.docker.com/)

A modern, full-stack Web GIS application designed for engineering teams to view, inspect, edit, spatially query, and topologically validate water utility networks (pipes, valves, hydrants).

Built as a technical assessment for **StrategizeIT** (GIS Full-Stack Developer).

---

## 📑 Table of Contents
1. [System Architecture](#1-system-architecture)
2. [Tech Stack](#2-tech-stack)
3. [Quick Start & Running Options](#3-quick-start--running-options)
   - [Option A: One-Command Docker Setup (Recommended)](#option-a-one-command-docker-setup-recommended)
   - [Option B: Manual Local Development](#option-b-manual-local-development)
4. [Key Architectural & Engineering Decisions (D1 – D8)](#4-key-architectural--engineering-decisions-d1--d8)
5. [Server Components vs. Client Components in Next.js](#5-server-components-vs-client-components-in-nextjs)
6. [Spatial Index Proof & Query Optimization](#6-spatial-index-proof--query-optimization)
7. [API Documentation Summary](#7-api-documentation-summary)
8. [Requirement Traceability Matrix](#8-requirement-traceability-matrix)
9. [Assumptions](#9-assumptions)
10. [What I Would Do With More Time](#10-what-i-would-do-with-more-time)

---

## 1. System Architecture

```text
utility-asset-manager/
├─ docker-compose.yml        # Multi-container orchestration (db, api, web)
├─ .env.example              # Environment variables template
├─ README.md                 # Complete system documentation
├─ backend/                  # NestJS TypeScript Application
│  ├─ Dockerfile             # Multi-stage production container
│  └─ src/
│     ├─ main.ts             # Bootstrap, CORS, ValidationPipe, Swagger
│     ├─ app.module.ts       # Root module
│     ├─ config/             # TypeORM DataSource & Environment config
│     ├─ database/           # Schema migrations & Seed dataset
│     ├─ assets/             # CRUD, Spatial endpoints, DTOs, Geometry util
│     ├─ validation/         # PostGIS topological validation engine
│     └─ health/             # DB & Service health check
└─ frontend/                 # Next.js App Router Application
   ├─ Dockerfile             # Multi-stage production container
   └─ src/
      ├─ app/                # Server Components (layout.tsx, page.tsx, globals.css)
      ├─ components/         # Client Components (AssetManager, MapView, Forms, Panels)
      ├─ lib/                # Typed API client, Geo projection utils, Symbology
      └─ types/              # Domain models & TypeScript interfaces
```

---

## 2. Tech Stack

| Layer | Technology | Rationale & Responsibility |
|---|---|---|
| **Frontend** | **Next.js 13.5 (App Router)** | Hybrid rendering, optimized production chunking, fast routing. |
| **Mapping Engine** | **ArcGIS Maps SDK for JS (`@arcgis/core`)** | Industry-standard spatial visualization, Web Mercator projection, `SketchViewModel` drawing, multi-layer graphics. |
| **Backend API** | **NestJS 10 (TypeScript)** | Modular architecture, dependency injection, global exception filters, Swagger OpenAPI. |
| **Validation Layer** | **class-validator / class-transformer** | Strict DTO validation with conditional logic (`@ValidateIf`), positive integer constraints. |
| **Database & GIS** | **PostgreSQL 15 + PostGIS 3.4** | Native spatial types, spherical geodesics, topological predicates (`ST_DWithin`, `ST_Intersects`, `ST_MakeValid`). |
| **Data Access** | **TypeORM (Raw SQL)** | Schema migrations and Connection Pool management with high-performance parameterized raw SQL (`$1, $2`). |
| **Containerization** | **Docker & Docker Compose** | Isolated multi-service stack with deterministic startup and health-check synchronization. |

---

## 3. Quick Start & Running Options

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) with Docker Compose support
- [Node.js v18+ LTS](https://nodejs.org/) & npm (if running outside Docker)

---

### Option A: One-Command Docker Setup (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/MustafaRamadan74/utility-asset-manager.git
   cd utility-asset-manager
   ```

2. **Prepare Environment File:**
   ```bash
   cp .env.example .env
   ```

3. **Build and Run All Services:**
   ```bash
   docker compose up --build -d
   ```
   *This starts the PostGIS database (`utility_asset_db`), runs backend migrations automatically on container startup (`utility_asset_api`), and compiles the Next.js frontend (`utility_asset_web`).*

4. **Seed the Water Utility Network (~30 assets):**
   ```bash
   docker compose exec api npm run seed
   ```

5. **Open Applications in Your Browser:**
   - **Web GIS Application**: [http://localhost:3000](http://localhost:3000)
   - **Swagger OpenAPI Documentation**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
   - **API Health Check**: [http://localhost:3001/api/health](http://localhost:3001/api/health)

---

### Option B: Manual Local Development

If you prefer to run services natively on your host machine:

1. **Start PostGIS Container:**
   ```bash
   docker compose up -d db
   ```

2. **Setup and Run Backend:**
   ```bash
   cd backend
   npm install
   npm run migration:run
   npm run seed
   npm run start:dev
   ```
   *Backend is available at `http://localhost:3001/api`.*

3. **Setup and Run Frontend:**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```
   *Frontend is available at `http://localhost:3000`.*

---

## 4. Key Architectural & Engineering Decisions (D1 – D8)

### D1. Degrees vs. Metres (Geographic vs. Geodetic Distance)
- **Problem**: Geometries are stored in WGS 84 (`EPSG:4326`) in angular units (degrees). Calculating distance or buffer thresholds using plain geometry in degrees (`ST_Distance` or `ST_DWithin`) produces distorted results that vary by latitude.
- **Solution**: All metric calculations cast the geometry to PostGIS `geography` (`geom::geography`), calculating geodesic distances in **metres** along the spheroid.
- **Index Support**: A standard GiST index on `geom` cannot index a cast expression. Therefore, we created a **second functional GiST index on the expression** `((geom::geography))`. Queries use the exact matching expression to ensure index traversal.

### D2. Defensive Database Schema
The database defends itself against corrupted inputs at the lowest level:
```sql
CONSTRAINT chk_name CHECK (length(btrim(name)) > 0),
CONSTRAINT chk_geom_valid CHECK (NOT ST_IsEmpty(geom) AND ST_IsValid(geom)),
CONSTRAINT chk_geom_type CHECK (
  (type = 'PIPE' AND GeometryType(geom) = 'LINESTRING') OR
  (type <> 'PIPE' AND GeometryType(geom) = 'POINT')
),
CONSTRAINT chk_pipe_diameter CHECK (
  (type = 'PIPE' AND diameter_mm IS NOT NULL AND diameter_mm > 0) OR
  (type <> 'PIPE' AND diameter_mm IS NULL)
);
```
- Every critical column is explicitly `NOT NULL`.
- `updated_at` is automatically updated via a PostgreSQL trigger function (`trigger_set_timestamp`).

### D3. Raw Parameterized SQL for Spatial Queries
While TypeORM is used for `DataSource` connection pooling and migration management, all spatial queries use raw SQL via `dataSource.query(sql, [params])`. This eliminates ORM impedance mismatches with PostGIS geometry types and ensures direct use of spatial indexes while completely preventing SQL injection.

### D4. PostGIS Topological Validation Engine
Topological network validation is executed directly in the database engine:
1. **`VALVE_NOT_ON_PIPE`**: Identifies valves whose geodetic distance is greater than 1 metre from any pipe:
   ```sql
   SELECT v.id, v.name, ST_AsGeoJSON(v.geom)::json AS geometry FROM assets v
   WHERE v.type = 'VALVE' AND NOT EXISTS (
     SELECT 1 FROM assets p WHERE p.type = 'PIPE'
     AND ST_DWithin(v.geom::geography, p.geom::geography, 1)
   );
   ```
2. **`DANGLING_PIPE_END`**: Extracts start and end points of every pipe and flags any endpoint that is not connected within 1 metre of another pipe, valve, or hydrant:
   ```sql
   WITH ends AS (
     SELECT id, name, ST_StartPoint(geom) AS pt, 'start' AS which FROM assets WHERE type = 'PIPE'
     UNION ALL
     SELECT id, name, ST_EndPoint(geom),         'end'   AS which FROM assets WHERE type = 'PIPE'
   )
   SELECT e.id, e.name, e.which, ST_AsGeoJSON(e.pt)::json AS geometry FROM ends e
   WHERE NOT EXISTS (
     SELECT 1 FROM assets o WHERE o.id <> e.id
     AND ST_DWithin(e.pt::geography, o.geom::geography, 1)
   );
   ```
Both rule results are transformed into a standard GeoJSON `FeatureCollection` with distinct problem geometries and detailed property payloads.

### D5. Immutability of Asset Type & Merge-and-Revalidate Rule
- Asset `type` (e.g. `PIPE` vs `VALVE`) is **immutable** after creation to preserve relational integrity and spatial constraints.
- In `PATCH /api/assets/:id`, the incoming payload is partial. The service loads the existing database row, merges the new attributes with the existing state, and re-validates the entire merged object (e.g. ensuring a pipe cannot be updated to diameter 0 or null, and a valve cannot receive a diameter).

### D6. Multi-Tier Validation
1. **DTO Layer**: `class-validator` enforces type rules, non-empty trimmed strings, valid enums, and positive integers.
2. **Geometry Utility (`geometry.util.ts`)**: Validates GeoJSON structure, coordinates array bounds (longitude [-180, 180], latitude [-90, 90]), position count, and polygon ring closure.
3. **Database Constraints (D2)**: Guarantees data validity even against direct SQL modifications.

### D7. Cartographic Symbology & Stale Request Cancellation
- **Symbology**: Active pipes (solid blue), decommissioned pipes (dashed slate grey), active valves (emerald green), active hydrants (crimson diamond), decommissioned points (hollow desaturated markers).
- **Network In-Flight Abort**: When panning or zooming quickly across the map, an `AbortController` cleanly cancels in-flight extent requests before initiating a new one, avoiding race conditions and backend congestion.

### D8. Networking & Dual-Environment Resolution
- Client browser interacts with `http://localhost:3001/api` (`NEXT_PUBLIC_API_URL`, baked at Next.js build time).
- Inside Docker, the backend connects to `db:5432` through the internal container network.
- Cross-Origin Resource Sharing (CORS) is explicitly configured via environment variable `CORS_ORIGIN=http://localhost:3000`.

---

## 5. Server Components vs. Client Components in Next.js

Next.js App Router enforces a clear architectural separation between server-rendered and client-interactive code:

### Server Components (`layout.tsx`, `page.tsx`)
- **Role**: Serve as the initial lightweight HTML shell.
- **Why**:
  - Zero client-side JavaScript bundle footprint for static markup.
  - SEO optimization: metadata, descriptive title, OpenGraph tags, and semantic structure rendered on the server.
  - Loads Esri stylesheet `@arcgis/core/assets/esri/themes/light/main.css` at the root document level.

### Client Components (`AssetManager`, `MapView`, `AssetForm`, `SelectionTable`, `ValidationList`)
- **Role**: Handle user interaction, WebGL rendering, and state management.
- **Why**:
  - **Browser Global Dependencies**: `@arcgis/core` depends on `window`, `document`, and WebGL Canvas APIs. Attempting to render ArcGIS MapView on the server results in `ReferenceError: window is not defined`.
  - **Dynamic Import with SSR Disabled**: `MapView` is loaded dynamically with `next/dynamic(() => import('./MapView'), { ssr: false })` **inside the Client Component (`AssetManager`)**, accompanied by a loading placeholder.
  - **State Ownership**: React hooks (`useState`, `useEffect`, `useRef`) manage selected assets, active interaction modes (`VIEW`, `ADD_ASSET`, `DRAW_POLYGON`), in-flight abort signals, and drawer visibility.

---

## 6. Spatial Index Proof & Query Optimization

### A. Honest Cost-Based Planner Behavior
The seeded dataset contains ~30 assets, which comfortably fits into a single memory page buffer (`Buffers: shared hit=1`). Under normal optimization, PostgreSQL selects a Sequential Scan because index page traversal incurs unnecessary overhead for tiny tables:

```text
Seq Scan on assets (cost=0.00..434.62 rows=33 width=66) (actual time=0.078..0.128 rows=33 loops=1)
  Filter: st_intersects(geom, '...'::geometry)
  Buffers: shared hit=1
```

### B. Index Availability Proof (`SET enable_seqscan = off;`)
By instructing the query planner to disable sequential scans, we demonstrate that the GiST index `idx_assets_geom` is valid, registered, and actively utilized:

```text
Index Scan using idx_assets_geom on assets (cost=0.14..442.00 rows=33 width=66) (actual time=0.275..0.421 rows=33 loops=1)
  Index Cond: (geom && '...'::geometry)
  Filter: st_intersects(geom, '...'::geometry)
  Buffers: shared hit=26
```

### C. KNN Spatial Index Usage (`<->` Operator)
For k-nearest-neighbour queries (`GET /api/assets/nearest`), PostgreSQL leverages the functional geography index `idx_assets_geom_geography` directly via the `<->` distance operator:

```text
-> Index Scan using idx_assets_geom_geography on assets a (cost=0.14..450.42 rows=33 width=82)
     Order By: ((geom)::geography <-> '...'::geography)
     Buffers: shared hit=183
```

### D. Geometric Correctness: `ST_Intersects` vs. `&&`
Unlike bounding box overlap (`&&`), which yields false positives for diagonal pipes whose rectangular envelope touches the query window without the line itself crossing it, our implementation applies exact `ST_Intersects(geom, ST_MakeEnvelope(...))` filtering, guaranteeing **0 false positives**.

---

## 7. API Documentation Summary

The backend exposes an interactive Swagger OpenAPI documentation portal at `http://localhost:3001/api/docs`.

| Method | Endpoint | Description | Query / Body Parameters |
|---|---|---|---|
| `GET` | `/api/health` | Healthcheck endpoint reporting service and DB status | None |
| `GET` | `/api/assets` | List assets, filtered by bbox and/or type/status | `bbox=minX,minY,maxX,maxY`, `type`, `status` |
| `POST` | `/api/assets` | Create a new utility asset | Body: `{ name, type, status, diameter_mm?, geometry }` |
| `GET` | `/api/assets/nearest` | KNN spatial search with geodesic distance in metres | `lng`, `lat`, `limit` (1–50) |
| `POST` | `/api/assets/query/within` | Find assets intersecting a user-drawn polygon | Body: GeoJSON Polygon object |
| `GET` | `/api/assets/:id` | Retrieve an asset by UUID | Path: `id` (UUID) |
| `PATCH` | `/api/assets/:id` | Partial update with D5 merge-and-revalidate rule | Path: `id`, Body: `{ name?, status?, diameter_mm? }` |
| `DELETE` | `/api/assets/:id` | Delete an asset by UUID | Path: `id` (UUID) |
| `GET` | `/api/validation/report` | Topological network validation report | None (returns GeoJSON FeatureCollection) |

---

## 8. Requirement Traceability Matrix

| Requirement | Implementation Component | Status |
|---|---|:---:|
| **PostGIS Container & Config** | `docker-compose.yml`, `.env.example`, PostGIS 3.4 | ✅ Completed (Phase 1) |
| **Schema Migration & Constraints** | `backend/src/database/migrations/*`, DDL with 4 CHECKs | ✅ Completed (Phase 2) |
| **Seeded Utility Network** | `backend/src/database/seed.ts` (30 assets + 4 deliberate errors) | ✅ Completed (Phase 3) |
| **NestJS Foundation & Swagger** | `backend/src/main.ts`, global prefix, `ValidationPipe`, Swagger | ✅ Completed (Phase 4) |
| **CRUD & Multi-Layer Validation** | `AssetsController`, `AssetsService`, `geometry.util.ts`, DTOs | ✅ Completed (Phase 5) |
| **Spatial Queries (BBOX, Within, KNN)** | Raw SQL templates, KNN `<->` index, `ST_MakeValid` | ✅ Completed (Phase 6) |
| **Topological Validation Report** | `ValidationService`, `VALVE_NOT_ON_PIPE`, `DANGLING_PIPE_END` | ✅ Completed (Phase 7) |
| **Frontend Map & Symbology** | Next.js App Router, `@arcgis/core`, OSM WebTileLayer | ✅ Completed (Phase 8) |
| **Asset Details & Editing Panel** | `AssetForm.tsx`, `PATCH` merge rule, `DELETE` with confirm | ✅ Completed (Phase 9) |
| **Add Asset, Polygon Selection & UI** | Point placement, `SketchViewModel`, `SelectionTable`, `ValidationList` | ✅ Completed (Phase 10) |
| **Production Docker & Delivery** | Multi-service Dockerfiles, Level A README, v1.0.0 Tag | ✅ Completed (Phase 11) |

---

## 9. Assumptions

1. **Immutability**: Asset `type` is immutable after creation.
2. **Diameter Enforcement**: `diameter_mm` is required and strictly positive (> 0 mm) for `PIPE` assets, and must remain `NULL` for `VALVE` and `HYDRANT`.
3. **Full Network Participation**: All network assets (including `DECOMMISSIONED`) participate in topological validation queries.
4. **Tolerance**: The spatial connectivity tolerance for water network topology is 1.0 metre.
5. **Bounding Box Cap**: Bounding box queries are capped at 5000 records to prevent browser memory exhaustion.
6. **OpenStreetMap Attributions**: OSM tiles are loaded via `WebTileLayer` for evaluation and demonstration purposes without requiring commercial API tokens.
7. **Networking**: The Docker Compose configuration assumes the evaluation browser runs on the same host machine as the Docker daemon (`localhost`).

---

## 10. What I Would Do With More Time

1. **Polyline Vertex Editing**: Integrate `SketchViewModel` vertex manipulation to allow engineers to reshape pipe geometries interactively on the map.
2. **Bulk GeoJSON Import/Export**: Add `POST /api/assets/import` and `GET /api/assets/export` endpoints with batch validation for CAD/Shapefile migration.
3. **Advanced Topological Rules**:
   - `ZERO_LENGTH_PIPE`: Detect pipes where start and end coordinates are identical.
   - `DUPLICATE_ASSETS`: Detect identical assets placed within 0.1 m of each other.
   - `PIPE_CROSSING_WITHOUT_JUNCTION`: Detect intersecting pipes lacking a valve or junction.
4. **Vector Tile Caching**: Implement Martin or pg_tileserv for generating Mapbox Vector Tiles (MVT) directly from PostGIS, supporting networks with 1,000,000+ assets at 60 FPS.
5. **Real-Time Network Telemetry**: WebSocket integration to push live sensor pressure and valve telemetry updates to the map.
