import {
  Asset,
  AssetStatus,
  AssetType,
  GeoJSONPolygon,
  ValidationReport,
} from '../types/asset';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface CreateAssetInput {
  name: string;
  type: AssetType;
  status?: AssetStatus;
  diameter_mm?: number | null;
  geometry: any;
}

export interface UpdateAssetInput {
  name?: string;
  status?: AssetStatus;
  diameter_mm?: number | null;
  geometry?: any;
}

export class ApiError extends Error {
  messages: string[];
  statusCode: number;

  constructor(statusCode: number, messages: string[]) {
    super(messages.join(', '));
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.messages = messages;
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorMessages = ['An unexpected API error occurred'];
    try {
      const data = await res.json();
      if (Array.isArray(data.message)) {
        errorMessages = data.message;
      } else if (typeof data.message === 'string') {
        errorMessages = [data.message];
      }
    } catch {
      errorMessages = [res.statusText || `HTTP ${res.status}`];
    }
    throw new ApiError(res.status, errorMessages);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export const api = {
  /**
   * Fetch assets by bounding box and optional type/status filters (D4/D7).
   */
  async getAssetsByBBox(
    bbox: string,
    filters?: { type?: AssetType; status?: AssetStatus },
    signal?: AbortSignal,
  ): Promise<Asset[]> {
    const params = new URLSearchParams({ bbox });
    if (filters?.type) params.set('type', filters.type);
    if (filters?.status) params.set('status', filters.status);

    return request<Asset[]>(`${API_BASE}/assets?${params.toString()}`, {
      method: 'GET',
      signal,
    });
  },

  /**
   * Get single asset by ID.
   */
  async getAssetById(id: string): Promise<Asset> {
    return request<Asset>(`${API_BASE}/assets/${id}`);
  },

  /**
   * Create a new asset.
   */
  async createAsset(data: CreateAssetInput): Promise<Asset> {
    return request<Asset>(`${API_BASE}/assets`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update asset by ID (PATCH).
   */
  async updateAsset(id: string, data: UpdateAssetInput): Promise<Asset> {
    return request<Asset>(`${API_BASE}/assets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete asset by ID.
   */
  async deleteAsset(id: string): Promise<{ deleted: boolean; id: string }> {
    return request<{ deleted: boolean; id: string }>(
      `${API_BASE}/assets/${id}`,
      {
        method: 'DELETE',
      },
    );
  },

  /**
   * Query assets intersecting a GeoJSON Polygon (D4).
   */
  async queryWithin(polygon: GeoJSONPolygon): Promise<Asset[]> {
    return request<Asset[]>(`${API_BASE}/assets/query/within`, {
      method: 'POST',
      body: JSON.stringify(polygon),
    });
  },

  /**
   * Find nearest assets by coordinates.
   */
  async getNearest(
    lng: number,
    lat: number,
    limit: number = 5,
  ): Promise<(Asset & { distance_m: number })[]> {
    const params = new URLSearchParams({
      lng: lng.toString(),
      lat: lat.toString(),
      limit: limit.toString(),
    });
    return request<(Asset & { distance_m: number })[]>(
      `${API_BASE}/assets/nearest?${params.toString()}`,
    );
  },

  /**
   * Fetch topological validation report (D4).
   */
  async getValidationReport(): Promise<ValidationReport> {
    return request<ValidationReport>(`${API_BASE}/validation/report`);
  },
};
