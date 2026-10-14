# Utility Asset Manager 🚰🗺️

A Web GIS application designed for engineering teams to view, edit, query, and validate water utility networks (pipes, valves, hydrants).

Built as a technical assessment for **StrategizeIT** (GIS Full-Stack Developer).

---

## 1. Tech Stack

- **Frontend**: Next.js 14+ (App Router, TypeScript), ArcGIS Maps SDK for JavaScript (`@arcgis/core`), Vanilla CSS / Modern UI tokens.
- **Backend**: NestJS (TypeScript), TypeORM (DataSource & Migrations), Swagger OpenAPI.
- **Database**: PostgreSQL 15+ with PostGIS 3.4 (`postgis/postgis:15-3.4`).
- **Containerization**: Docker & Docker Compose.

---

## 2. Architecture & Directory Structure

```text
utility-asset-manager/
├─ docker-compose.yml        # Multi-container orchestration (DB, API, Web)
├─ .env.example              # Environment variables template
├─ README.md                 # Project documentation
├─ backend/                  # NestJS application
│  └─ src/
│     ├─ main.ts
│     ├─ app.module.ts
│     ├─ config/             # Database connection & TypeORM DataSource
│     ├─ database/           # Migrations and Seed scripts
│     ├─ assets/             # Assets CRUD, spatial queries, DTOs, SQL templates
│     └─ validation/         # Topological network validation rules
└─ frontend/                 # Next.js App Router application
   └─ src/
      ├─ app/                # Server Components (layout.tsx, page.tsx)
      ├─ components/         # Client Components (AssetManager, MapView, Forms)
      ├─ lib/                # API client, geo projection utils, symbology
      └─ types/              # Shared TypeScript definitions
```

---

## 3. Quick Start & How to Run

### Prerequisites
- Node.js (v18+ LTS) & npm
- Docker Desktop with Docker Compose
- pgAdmin 4 (optional, for inspecting data)
- ArcGIS Pro (optional, for visual QA)

### 1. Clone & Configure Environment
```bash
git clone https://github.com/MustafaRamadan74/utility-asset-manager.git
cd utility-asset-manager
cp .env.example .env
```

### 2. Start Database Container
```bash
docker compose up -d db
```
The database container includes PostGIS 3.4 and runs on port `5432` with a built-in health check.

---

## 4. Key Architectural Decisions (D1 – D8)

- **D1. Degrees vs. Metres:** Asset geometries are stored in WGS 84 (`EPSG:4326`). Spatial metric calculations (`ST_Distance`, `ST_DWithin`) cast geometry to `geography` (`geom::geography`) for geodesic measurements in metres on the spheroid. A dedicated expression GiST index `((geom::geography))` backs these operations.
- **D2. Defensive Database Schema:** Required fields are explicitly `NOT NULL`. Integrity is strictly enforced via database `CHECK` constraints (geometry validity, geometry type per asset, pipe diameter rules).
- **D3. Query Strategy:** Raw SQL queries with parameterized inputs (`$1, $2`) via TypeORM DataSource for maximum spatial performance and PostGIS function support.
- **D4. Topological Rules:** Network integrity is checked in the database engine:
  - `VALVE_NOT_ON_PIPE`: Detects valves located > 1 metre from any pipe.
  - `DANGLING_PIPE_END`: Detects pipe endpoints not connected within 1 metre of another pipe, valve, or hydrant.
- **D5. Immutability:** Asset `type` is immutable after creation to preserve relational and spatial integrity.
- **D6. Multi-Layer Validation:** Request data is validated across DTO class-validators, geometry utilities, and database CHECK constraints.
- **D7. Hybrid Rendering:** Server Components for initial shell (`layout.tsx`, `page.tsx`) and dynamic Client Component for interactive map views (`@arcgis/core` loaded with `ssr: false`).
- **D8. Environment & Networking:** Clear separation between internal Docker hostnames (`db`) and client-side browser endpoints (`http://localhost:3001/api`).

---

## 5. Requirement Traceability

| Requirement | Phase | Status |
|---|---|:---:|
| PostGIS Docker Container & Environment Config | Phase 1 | ✅ Completed |
| Schema Migration, Enums, Constraints & Spatial Indexes | Phase 2 | Planned |
| Seed Data (~30 assets + 4 deliberate topological errors) | Phase 3 | Planned |
| NestJS Foundation, Swagger & Health Checks | Phase 4 | Planned |
| Asset CRUD, DTOs & Validation | Phase 5 | Planned |
| Spatial Queries (BBOX, Within Polygon, Nearest with KNN) | Phase 6 | Planned |
| Topological Validation Report Endpoint | Phase 7 | Planned |
| Frontend Shell, ArcGIS MapView & Symbology | Phase 8 | Planned |
| Asset Details & Editing Panel | Phase 9 | Planned |
| Asset Creation, Polygon Selection & Validation UI | Phase 10 | Planned |
| Full Production Dockerization & Video Demo | Phase 11 | Planned |

---

## 6. Assumptions

1. Asset `type` is immutable after creation.
2. `diameter_mm` is mandatory and strictly positive for `PIPE`, and must be `NULL` for `VALVE` and `HYDRANT`.
3. All assets (including `DECOMMISSIONED`) participate in network topological validation.
4. Topological tolerance for connectivity is 1.0 metre.
5. Spatial bounding box (`bbox`) queries are capped at 5000 records.
6. OpenStreetMap tiles are used for demonstration purposes without requiring proprietary API tokens.
7. Docker configuration assumes the client browser runs on the same host machine.
