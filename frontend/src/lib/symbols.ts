import { AssetStatus, AssetType, ValidationRule } from '../types/asset';

// Color palette
const COLORS = {
  pipeActive: [30, 136, 229, 1], // Vibrant Deep Blue
  pipeMaintenance: [245, 158, 11, 1], // Amber Orange
  pipeDecommissioned: [100, 116, 139, 0.8], // Slate Grey

  valveActive: [16, 185, 129, 1], // Emerald Green
  valveMaintenance: [245, 158, 11, 1], // Amber
  valveDecommissioned: [148, 163, 184, 0.9], // Slate

  hydrantActive: [239, 68, 68, 1], // Crimson Red
  hydrantMaintenance: [245, 158, 11, 1], // Amber
  hydrantDecommissioned: [148, 163, 184, 0.9], // Slate

  selection: [0, 229, 255, 1], // Vibrant Cyan Glow
  issueValve: [245, 158, 11, 1], // Warning Orange
  issuePipe: [239, 68, 68, 1], // Error Crimson
};

/**
 * Returns ArcGIS symbol definition for an asset based on type and operational status (D7).
 * Decommissioned assets are styled as dashed lines (pipes) or hollow markers (valves/hydrants).
 */
export function getAssetSymbol(type: AssetType, status: AssetStatus): any {
  if (type === 'PIPE') {
    if (status === 'DECOMMISSIONED') {
      return {
        type: 'simple-line',
        color: COLORS.pipeDecommissioned,
        width: 2.5,
        style: 'dash',
      };
    }
    if (status === 'MAINTENANCE') {
      return {
        type: 'simple-line',
        color: COLORS.pipeMaintenance,
        width: 3.5,
        style: 'solid',
      };
    }
    return {
      type: 'simple-line',
      color: COLORS.pipeActive,
      width: 3.5,
      style: 'solid',
    };
  }

  if (type === 'VALVE') {
    if (status === 'DECOMMISSIONED') {
      return {
        type: 'simple-marker',
        style: 'circle',
        color: [0, 0, 0, 0], // Hollow fill
        size: 11,
        outline: {
          color: COLORS.valveDecommissioned,
          width: 2,
        },
      };
    }
    const color =
      status === 'MAINTENANCE' ? COLORS.valveMaintenance : COLORS.valveActive;
    return {
      type: 'simple-marker',
      style: 'circle',
      color,
      size: 11,
      outline: {
        color: [255, 255, 255, 1],
        width: 1.5,
      },
    };
  }

  // HYDRANT (diamond marker)
  if (status === 'DECOMMISSIONED') {
    return {
      type: 'simple-marker',
      style: 'diamond',
      color: [0, 0, 0, 0], // Hollow fill
      size: 12,
      outline: {
        color: COLORS.hydrantDecommissioned,
        width: 2,
      },
    };
  }
  const color =
    status === 'MAINTENANCE'
      ? COLORS.hydrantMaintenance
      : COLORS.hydrantActive;
  return {
    type: 'simple-marker',
    style: 'diamond',
    color,
    size: 12,
    outline: {
      color: [255, 255, 255, 1],
      width: 1.5,
    },
  };
}

/**
 * Symbol for highlighting selected assets (polygon selection or single click).
 */
export function getSelectionSymbol(type: AssetType): any {
  if (type === 'PIPE') {
    return {
      type: 'simple-line',
      color: COLORS.selection,
      width: 6,
      style: 'solid',
    };
  }
  return {
    type: 'simple-marker',
    style: 'circle',
    color: [0, 229, 255, 0.4],
    size: 20,
    outline: {
      color: COLORS.selection,
      width: 3,
    },
  };
}

/**
 * Symbol for displaying topological validation issues on the map (D4/D7).
 */
export function getValidationIssueSymbol(rule: ValidationRule): any {
  if (rule === 'VALVE_NOT_ON_PIPE') {
    return {
      type: 'simple-marker',
      style: 'triangle',
      color: COLORS.issueValve,
      size: 14,
      outline: {
        color: [255, 255, 255, 1],
        width: 2,
      },
    };
  }

  // DANGLING_PIPE_END
  return {
    type: 'simple-marker',
    style: 'x',
    color: COLORS.issuePipe,
    size: 14,
    outline: {
      color: COLORS.issuePipe,
      width: 3,
    },
  };
}
