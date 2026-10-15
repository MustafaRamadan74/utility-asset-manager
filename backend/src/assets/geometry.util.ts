import { BadRequestException } from '@nestjs/common';
import { AssetType } from './asset.types';

function isValidCoordinate(pos: any): pos is [number, number] {
  if (!Array.isArray(pos) || pos.length < 2) return false;
  const [lng, lat] = pos;
  return (
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

/**
 * Validates GeoJSON geometry against asset type and coordinate boundaries.
 * Throws BadRequestException with an array of specific error messages if invalid.
 */
export function validateAssetGeometry(type: AssetType, geom: any): void {
  const errors: string[] = [];

  if (!geom || typeof geom !== 'object') {
    throw new BadRequestException(['geometry must be a valid GeoJSON object']);
  }

  if (type === AssetType.PIPE) {
    if (geom.type !== 'LineString') {
      errors.push(`Geometry type for PIPE must be 'LineString', received '${geom.type}'`);
    } else if (!Array.isArray(geom.coordinates) || geom.coordinates.length < 2) {
      errors.push('PIPE LineString must have at least 2 coordinate positions');
    } else {
      geom.coordinates.forEach((coord: any, index: number) => {
        if (!isValidCoordinate(coord)) {
          errors.push(
            `Invalid coordinate at index ${index}: expected [lng, lat] with finite numbers, lng in [-180, 180], lat in [-90, 90]`,
          );
        }
      });
    }
  } else {
    // VALVE or HYDRANT
    if (geom.type !== 'Point') {
      errors.push(`Geometry type for ${type} must be 'Point', received '${geom.type}'`);
    } else if (!isValidCoordinate(geom.coordinates)) {
      errors.push(
        `Invalid Point coordinate: expected [lng, lat] with finite numbers, lng in [-180, 180], lat in [-90, 90]`,
      );
    }
  }

  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }
}

/**
 * Validates a GeoJSON Polygon for spatial within queries.
 */
export function validatePolygonGeometry(geom: any): void {
  const errors: string[] = [];

  if (!geom || typeof geom !== 'object') {
    throw new BadRequestException(['Polygon geometry must be a valid GeoJSON object']);
  }

  if (geom.type !== 'Polygon') {
    errors.push(`Geometry type must be 'Polygon', received '${geom.type}'`);
  } else if (
    !Array.isArray(geom.coordinates) ||
    geom.coordinates.length === 0 ||
    !Array.isArray(geom.coordinates[0]) ||
    geom.coordinates[0].length < 4
  ) {
    errors.push('Polygon exterior ring must have at least 4 coordinate positions');
  } else {
    const ring = geom.coordinates[0];
    ring.forEach((coord: any, index: number) => {
      if (!isValidCoordinate(coord)) {
        errors.push(
          `Invalid Polygon ring coordinate at index ${index}: expected [lng, lat] in valid range`,
        );
      }
    });

    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      errors.push('Polygon exterior ring must be closed (first and last coordinate must match)');
    }
  }

  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }
}
