/**
 * Shared SQL column list ensuring consistent Asset shape across all spatial queries.
 * Casts geom to GeoJSON format aliased as 'geometry'.
 */
export const ASSET_COLUMNS = `
  id,
  type,
  name,
  status,
  diameter_mm,
  ST_AsGeoJSON(geom)::json AS geometry,
  created_at,
  updated_at
`;
