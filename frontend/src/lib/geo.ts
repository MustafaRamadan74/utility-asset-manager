import * as webMercatorUtils from '@arcgis/core/geometry/support/webMercatorUtils';
import Point from '@arcgis/core/geometry/Point';
import Polyline from '@arcgis/core/geometry/Polyline';
import Graphic from '@arcgis/core/Graphic';
import { Asset, ValidationFeature } from '../types/asset';
import {
  getAssetSymbol,
  getSelectionSymbol,
  getValidationIssueSymbol,
} from './symbols';

/**
 * Converts a MapView Web Mercator extent to a clamped WGS84 bbox query string.
 * Format: minX,minY,maxX,maxY (lngMin,latMin,lngMax,latMax).
 */
export function extentToBbox(extent: __esri.Extent): string {
  // Convert Web Mercator extent to Geographic WGS84
  const geoExtent = webMercatorUtils.webMercatorToGeographic(
    extent,
  ) as __esri.Extent;

  // Clamp coordinates to valid WGS84 boundaries to prevent out-of-range queries on zoomed-out views
  const minX = Math.max(-180, Math.min(180, geoExtent.xmin));
  const maxX = Math.max(-180, Math.min(180, geoExtent.xmax));
  const minY = Math.max(-90, Math.min(90, geoExtent.ymin));
  const maxY = Math.max(-90, Math.min(90, geoExtent.ymax));

  return `${minX.toFixed(6)},${minY.toFixed(6)},${maxX.toFixed(6)},${maxY.toFixed(6)}`;
}

/**
 * Creates an ArcGIS Graphic from an Asset GeoJSON definition.
 */
export function assetToGraphic(asset: Asset): Graphic {
  let geometry: __esri.Geometry;

  if (asset.type === 'PIPE') {
    geometry = new Polyline({
      paths: [(asset.geometry as any).coordinates],
      spatialReference: { wkid: 4326 },
    });
  } else {
    // VALVE or HYDRANT
    const coords = (asset.geometry as any).coordinates;
    geometry = new Point({
      longitude: coords[0],
      latitude: coords[1],
      spatialReference: { wkid: 4326 },
    });
  }

  return new Graphic({
    geometry,
    symbol: getAssetSymbol(asset.type, asset.status),
    attributes: {
      ...asset,
      rawGeometry: JSON.stringify(asset.geometry),
    },
  });
}

/**
 * Creates a highlight Graphic for selected assets.
 */
export function assetToSelectionGraphic(asset: Asset): Graphic | null {
  if (!asset) return null;

  let geom = asset.geometry;
  if (!geom && (asset as any).rawGeometry) {
    try {
      geom = JSON.parse((asset as any).rawGeometry);
    } catch {}
  }

  if (!geom || !(geom as any).coordinates) {
    return null;
  }

  let geometry: __esri.Geometry;

  if (asset.type === 'PIPE') {
    geometry = new Polyline({
      paths: [(geom as any).coordinates],
      spatialReference: { wkid: 4326 },
    });
  } else {
    const coords = (geom as any).coordinates;
    geometry = new Point({
      longitude: coords[0],
      latitude: coords[1],
      spatialReference: { wkid: 4326 },
    });
  }

  return new Graphic({
    geometry,
    symbol: getSelectionSymbol(asset.type),
    attributes: { id: asset.id },
  });
}

/**
 * Creates an ArcGIS Graphic from a ValidationFeature issue.
 */
export function issueToGraphic(feature: ValidationFeature): Graphic {
  const [lng, lat] = feature.geometry.coordinates;
  const geometry = new Point({
    longitude: lng,
    latitude: lat,
    spatialReference: { wkid: 4326 },
  });

  return new Graphic({
    geometry,
    symbol: getValidationIssueSymbol(feature.properties.rule),
    attributes: { ...feature.properties },
  });
}
