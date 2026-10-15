export type AssetType = 'PIPE' | 'VALVE' | 'HYDRANT';
export type AssetStatus = 'ACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED';

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export type AssetGeometry = GeoJSONPoint | GeoJSONLineString;

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  status: AssetStatus;
  diameter_mm: number | null;
  geometry: AssetGeometry;
  created_at: string;
  updated_at: string;
  distance_m?: number;
}

export type InteractionMode = 'VIEW' | 'ADD_ASSET' | 'DRAW_POLYGON';

export type ValidationRule =
  | 'VALVE_NOT_ON_PIPE'
  | 'DANGLING_PIPE_END'
  | 'DUPLICATE_POINTS';

export interface NetworkSummary {
  totalAssets: number;
  pipesCount: number;
  valvesCount: number;
  hydrantsCount: number;
  activeCount: number;
  maintenanceCount: number;
  decommissionedCount: number;
  totalPipeLengthM: number;
}

export interface ValidationIssueProperties {
  rule: ValidationRule;
  asset_ids: string[];
  message: string;
}

export interface ValidationFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: ValidationIssueProperties;
}

export interface ValidationReport {
  type: 'FeatureCollection';
  features: ValidationFeature[];
}
