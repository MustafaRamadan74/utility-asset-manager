export type ValidationRule = 'VALVE_NOT_ON_PIPE' | 'DANGLING_PIPE_END';

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
