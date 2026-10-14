'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Asset,
  AssetStatus,
  AssetType,
  GeoJSONPolygon,
  InteractionMode,
  ValidationReport,
} from '../types/asset';
import { api } from '../lib/api';

// Dynamic import with SSR disabled inside Client Component (D7)
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: '#0f172a',
        color: '#94a3b8',
        fontSize: '14px',
      }}
    >
      <div className="spinner" style={{ marginRight: '10px' }} />
      Initializing ArcGIS MapView...
    </div>
  ),
});

export default function AssetManager() {
  const [mode, setMode] = useState<InteractionMode>('VIEW');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [validationReport, setValidationReport] =
    useState<ValidationReport | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isCapped, setIsCapped] = useState(false);
  const [assetCount, setAssetCount] = useState(0);

  const [filters, setFilters] = useState<{
    type?: AssetType;
    status?: AssetStatus;
  }>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRunValidation = async () => {
    setIsLoading(true);
    try {
      const report = await api.getValidationReport();
      setValidationReport(report);
      alert(`Validation complete! Found ${report.features.length} issues.`);
    } catch (err: any) {
      alert(`Validation failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearIssues = () => {
    setValidationReport(null);
  };

  const handleClearSelection = () => {
    setSelectedAsset(null);
    setSelectedAssets([]);
    setMode('VIEW');
  };

  return (
    <div className="app-container">
      {/* Header Bar */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon">🚰</div>
          <div>
            <div className="brand-title">Utility Asset Manager</div>
          </div>
          <span className="brand-badge">WGS 84</span>
        </div>

        {/* Mode Selector Toolbar */}
        <div className="header-controls">
          <div className="button-group">
            <button
              className={`btn-toggle ${mode === 'VIEW' ? 'active' : ''}`}
              onClick={() => {
                setMode('VIEW');
                setSelectedAssets([]);
              }}
            >
              👁️ View & Inspect
            </button>
            <button
              className={`btn-toggle ${mode === 'ADD_ASSET' ? 'active' : ''}`}
              onClick={() => {
                setMode('ADD_ASSET');
                setSelectedAsset(null);
                setSelectedAssets([]);
              }}
            >
              ➕ Add Asset
            </button>
            <button
              className={`btn-toggle ${mode === 'DRAW_POLYGON' ? 'active' : ''}`}
              onClick={() => {
                setMode('DRAW_POLYGON');
                setSelectedAsset(null);
              }}
            >
              ✏️ Select Polygon
            </button>
          </div>

          {/* Type Filter */}
          <select
            className="form-select"
            style={{ width: '130px', padding: '6px 10px', fontSize: '13px' }}
            value={filters.type || ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                type: (e.target.value as AssetType) || undefined,
              }))
            }
          >
            <option value="">All Types</option>
            <option value="PIPE">Pipes</option>
            <option value="VALVE">Valves</option>
            <option value="HYDRANT">Hydrants</option>
          </select>

          {/* Status Filter */}
          <select
            className="form-select"
            style={{ width: '140px', padding: '6px 10px', fontSize: '13px' }}
            value={filters.status || ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                status: (e.target.value as AssetStatus) || undefined,
              }))
            }
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="DECOMMISSIONED">Decommissioned</option>
          </select>

          {/* Validation Report Button */}
          <button
            className="btn-action btn-primary"
            onClick={handleRunValidation}
            disabled={isLoading}
          >
            🛡️ Run Validation
          </button>

          {validationReport && (
            <button className="btn-action" onClick={handleClearIssues}>
              Clear Issues ({validationReport.features.length})
            </button>
          )}
        </div>
      </header>

      {/* Map View Area */}
      <div className="map-viewport">
        {/* Floating Top-Left HUD (Loading & Capped Banner) */}
        <div className="map-hud-top-left">
          {isLoading && (
            <div className="loading-pill">
              <div className="spinner" />
              Loading extent assets...
            </div>
          )}

          {isCapped && (
            <div className="cap-warning-banner">
              ⚠️ Showing the first 5000 assets, zoom in for detailed view
            </div>
          )}
        </div>

        {/* Floating Top-Right HUD (Legend & Counter) */}
        <div className="map-hud-top-right">
          <div className="legend-card">
            <div className="legend-title">Network Legend</div>
            <div className="legend-item">
              <span className="legend-swatch swatch-pipe" />
              <span>Pipe (Active)</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch swatch-pipe-decom" />
              <span>Pipe (Decommissioned)</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch swatch-valve" />
              <span>Valve</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch swatch-hydrant" />
              <span>Hydrant</span>
            </div>
            <div
              style={{
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '11px',
                color: 'var(--text-dim)',
              }}
            >
              Visible Assets: <strong style={{ color: 'var(--text-main)' }}>{assetCount}</strong>
            </div>
          </div>
        </div>

        {/* ArcGIS MapView */}
        <MapView
          mode={mode}
          filters={filters}
          selectedAsset={selectedAsset}
          selectedAssets={selectedAssets}
          validationReport={validationReport}
          refreshTrigger={refreshTrigger}
          onAssetSelect={(asset) => setSelectedAsset(asset)}
          onAssetsLoaded={(count, capped) => {
            setAssetCount(count);
            setIsCapped(capped);
          }}
          onLoadingChange={(loading) => setIsLoading(loading)}
          onMapClickPoint={(coords) => {
            alert(`Map clicked at: [${coords[0]}, ${coords[1]}]. (Phase 10 AssetForm modal will open here)`);
          }}
          onPolygonDrawn={async (poly) => {
            setIsLoading(true);
            try {
              const matching = await api.queryWithin(poly);
              setSelectedAssets(matching);
              alert(`Selected ${matching.length} assets intersecting polygon!`);
            } catch (err: any) {
              alert(`Selection query failed: ${err.message}`);
            } finally {
              setIsLoading(false);
            }
          }}
        />

        {/* Asset Details Side Panel (Placeholder for Phase 9) */}
        {selectedAsset && (
          <aside className="side-drawer">
            <div className="drawer-header">
              <div className="drawer-title">
                {selectedAsset.type}: {selectedAsset.name}
              </div>
              <button
                className="drawer-close-btn"
                onClick={handleClearSelection}
              >
                ✕
              </button>
            </div>
            <div className="drawer-content">
              <div className="form-group">
                <label className="form-label">ID</label>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  {selectedAsset.id}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <div>{selectedAsset.type}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <div>{selectedAsset.status}</div>
              </div>
              {selectedAsset.diameter_mm && (
                <div className="form-group">
                  <label className="form-label">Diameter (mm)</label>
                  <div>{selectedAsset.diameter_mm} mm</div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Geometry</label>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', wordBreak: 'break-all' }}>
                  {JSON.stringify(selectedAsset.geometry)}
                </div>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '16px' }}>
                Full editing & deletion form will be activated in Phase 9.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
