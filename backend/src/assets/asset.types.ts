export enum AssetType {
  PIPE = 'PIPE',
  VALVE = 'VALVE',
  HYDRANT = 'HYDRANT',
}

export enum AssetStatus {
  ACTIVE = 'ACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  DECOMMISSIONED = 'DECOMMISSIONED',
}

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
  created_at: Date;
  updated_at: Date;
}
