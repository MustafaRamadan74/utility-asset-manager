'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Asset,
  AssetStatus,
  AssetType,
  InteractionMode,
  NetworkSummary,
  ValidationFeature,
  ValidationReport,
} from '../types/asset';
import { api } from '../lib/api';
import AssetForm from './AssetForm';
import SelectionTable from './SelectionTable';
import ValidationList from './ValidationList';

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
  const [addAssetSubtype, setAddAssetSubtype] = useState<'POINT' | 'PIPE'>('POINT');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [createPoint, setCreatePoint] = useState<[number, number] | null>(null);
  const [createPipeCoords, setCreatePipeCoords] = useState<[number, number][] | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [validationReport, setValidationReport] =
    useState<ValidationReport | null>(null);

  const [showSelectionTable, setShowSelectionTable] = useState(false);
  const [showValidationList, setShowValidationList] = useState(false);
  const [zoomLocation, setZoomLocation] = useState<{
    center: [number, number];
    zoom?: number;
    timestamp: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isCapped, setIsCapped] = useState(false);
  const [assetCount, setAssetCount] = useState(0);

  // Network summary metrics (B4)
  const [summary, setSummary] = useState<NetworkSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'LEGEND' | 'SUMMARY'>('LEGEND');
  const [isHudMinimized, setIsHudMinimized] = useState(false);

  // Mobile menu dropdown state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [filters, setFilters] = useState<{
    type?: AssetType;
    status?: AssetStatus;
  }>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch summary data on mount and on changes
  const loadSummary = async () => {
    try {
      const data = await api.getSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load network summary:', err);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [refreshTrigger]);

  const handleRunValidation = async () => {
    setIsLoading(true);
    try {
      const report = await api.getValidationReport();
      setValidationReport(report);
      setShowValidationList(true);
      setShowSelectionTable(false);
      setSelectedAsset(null);
      setCreatePoint(null);
      setCreatePipeCoords(null);
    } catch (err: any) {
      alert(`Validation failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearIssues = () => {
    setValidationReport(null);
    setShowValidationList(false);
  };

  const handleClearSelection = () => {
    setSelectedAsset(null);
    setSelectedAssets([]);
    setCreatePoint(null);
    setCreatePipeCoords(null);
    setShowSelectionTable(false);
    setMode('VIEW');
  };

  const handleSelectTableRowClick = (asset: Asset) => {
    setSelectedAsset(asset);
    const coords: [number, number] =
      asset.geometry.type === 'Point'
        ? asset.geometry.coordinates
        : asset.geometry.coordinates[
            Math.floor(asset.geometry.coordinates.length / 2)
          ];
    setZoomLocation({
      center: coords,
      zoom: 19,
      timestamp: Date.now(),
    });
  };

  const handleIssueRowClick = (feature: ValidationFeature) => {
    setZoomLocation({
      center: feature.geometry.coordinates,
      zoom: 19,
      timestamp: Date.now(),
    });
  };

  return (
    <div className="app-container">
      {/* Header Bar */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-title">Utility Asset Manager</div>
        </div>

        {/* Desktop Controls (Hidden on mobile via CSS) */}
        <div className="header-controls desktop-controls">
          <div className="button-group">
            <button
              className={`btn-toggle ${mode === 'VIEW' ? 'active' : ''}`}
              onClick={() => {
                setMode('VIEW');
                setCreatePoint(null);
                setCreatePipeCoords(null);
              }}
            >
              👁️ View &amp; Inspect
            </button>
            <button
              className={`btn-toggle ${mode === 'ADD_ASSET' ? 'active' : ''}`}
              onClick={() => {
                setMode('ADD_ASSET');
                setSelectedAsset(null);
                setShowSelectionTable(false);
              }}
            >
              ➕ Add Asset
            </button>
            <button
              className={`btn-toggle ${mode === 'DRAW_POLYGON' ? 'active' : ''}`}
              onClick={() => {
                setMode('DRAW_POLYGON');
                setSelectedAsset(null);
                setCreatePoint(null);
                setCreatePipeCoords(null);
              }}
            >
              ✏️ Select Polygon
            </button>
          </div>

          {/* Subtype selector when adding asset */}
          {mode === 'ADD_ASSET' && (
            <div className="button-group add-subtype-group">
              <button
                className={`btn-toggle ${addAssetSubtype === 'POINT' ? 'active' : ''}`}
                onClick={() => setAddAssetSubtype('POINT')}
                title="Click on map to place a Valve or Hydrant point"
              >
                📍 Point
              </button>
              <button
                className={`btn-toggle ${addAssetSubtype === 'PIPE' ? 'active' : ''}`}
                onClick={() => setAddAssetSubtype('PIPE')}
                title="Click and drag/double-click on map to draw a Pipe polyline"
              >
                📏 Pipe
              </button>
            </div>
          )}

          {/* Type Filter */}
          <select
            className="form-select filter-select"
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
            className="form-select filter-select"
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

        {/* Mobile 3-dash Hamburger button */}
        <button
          className="mobile-hamburger-btn"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle navigation tools"
          aria-expanded={isMobileMenuOpen}
        >
          <span className="hamburger-dash" />
          <span className="hamburger-dash" />
          <span className="hamburger-dash" />
        </button>
      </header>

      {/* Mobile Tools Dropdown */}
      {isMobileMenuOpen && (
        <div className="mobile-tools-dropdown">
          <div className="mobile-section-label">Interaction Mode</div>
          <div className="mobile-btn-stack">
            <button
              className={`btn-action ${mode === 'VIEW' ? 'btn-primary' : ''}`}
              onClick={() => {
                setMode('VIEW');
                setCreatePoint(null);
                setCreatePipeCoords(null);
                setIsMobileMenuOpen(false);
              }}
            >
              👁️ View &amp; Inspect
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                style={{ flex: 1 }}
                className={`btn-action ${mode === 'ADD_ASSET' && addAssetSubtype === 'POINT' ? 'btn-primary' : ''}`}
                onClick={() => {
                  setMode('ADD_ASSET');
                  setAddAssetSubtype('POINT');
                  setSelectedAsset(null);
                  setShowSelectionTable(false);
                  setIsMobileMenuOpen(false);
                }}
              >
                📍 Add Point
              </button>
              <button
                style={{ flex: 1 }}
                className={`btn-action ${mode === 'ADD_ASSET' && addAssetSubtype === 'PIPE' ? 'btn-primary' : ''}`}
                onClick={() => {
                  setMode('ADD_ASSET');
                  setAddAssetSubtype('PIPE');
                  setSelectedAsset(null);
                  setShowSelectionTable(false);
                  setIsMobileMenuOpen(false);
                }}
              >
                📏 Draw Pipe
              </button>
            </div>

            <button
              className={`btn-action ${mode === 'DRAW_POLYGON' ? 'btn-primary' : ''}`}
              onClick={() => {
                setMode('DRAW_POLYGON');
                setSelectedAsset(null);
                setCreatePoint(null);
                setCreatePipeCoords(null);
                setIsMobileMenuOpen(false);
              }}
            >
              ✏️ Select Polygon
            </button>
          </div>

          <div className="mobile-section-label">Filters</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <select
              className="form-select"
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

            <select
              className="form-select"
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
          </div>

          <div className="mobile-section-label">Network Validation</div>
          <button
            className="btn-action btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginBottom: '8px' }}
            onClick={() => {
              handleRunValidation();
              setIsMobileMenuOpen(false);
            }}
            disabled={isLoading}
          >
            🛡️ Run Validation
          </button>

          {validationReport && (
            <button
              className="btn-action"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                handleClearIssues();
                setIsMobileMenuOpen(false);
              }}
            >
              Clear Issues ({validationReport.features.length})
            </button>
          )}
        </div>
      )}

      {/* Map View Area */}
      <div className="map-viewport">
        {/* Floating Top-Left HUD (Loading & Capped Banner) */}
        <div className="map-hud-top-left">
          {isLoading && (
            <div className="loading-pill">
              <div className="spinner" />
              Loading network data...
            </div>
          )}

          {isCapped && (
            <div className="cap-warning-banner">
              ⚠️ Showing the first 5000 assets, zoom in for detailed view
            </div>
          )}

          {mode === 'ADD_ASSET' && (
            <div className="drawing-guide-pill">
              {addAssetSubtype === 'PIPE'
                ? '📏 Click on map to place pipe vertices, double-click to finish'
                : '📍 Click anywhere on the map to place a Valve or Hydrant'}
            </div>
          )}
        </div>

        {/* Floating Bottom-Right HUD (Compact 3-Category Legend & Summary Panel) */}
        <div className="map-hud-bottom-right">
          {isHudMinimized ? (
            <button
              className="hud-minimized-pill"
              onClick={() => setIsHudMinimized(false)}
              title="Expand Legend &amp; Summary"
            >
              🗺️ Network Info
            </button>
          ) : (
            <div className="legend-card compact-legend-card">
              <div className="hud-tab-header">
                <div className="hud-tabs">
                  <button
                    className={`hud-tab-btn ${activeTab === 'LEGEND' ? 'active' : ''}`}
                    onClick={() => setActiveTab('LEGEND')}
                  >
                    Legend
                  </button>
                  <button
                    className={`hud-tab-btn ${activeTab === 'SUMMARY' ? 'active' : ''}`}
                    onClick={() => setActiveTab('SUMMARY')}
                  >
                    Summary
                  </button>
                </div>
                <button
                  className="hud-close-btn"
                  onClick={() => setIsHudMinimized(true)}
                  aria-label="Minimize"
                  title="Minimize"
                >
                  ✕
                </button>
              </div>

              {activeTab === 'LEGEND' ? (
                <div className="legend-categories">
                  {/* Category 1: Pipes */}
                  <div className="legend-category">
                    <div className="legend-category-title">Pipe</div>
                    <div className="legend-sub-item">
                      <span className="legend-swatch swatch-pipe-active" />
                      <span>Active</span>
                    </div>
                    <div className="legend-sub-item">
                      <span className="legend-swatch swatch-pipe-maint" />
                      <span>Maintenance</span>
                    </div>
                    <div className="legend-sub-item">
                      <span className="legend-swatch swatch-pipe-decom" />
                      <span>Decommissioned</span>
                    </div>
                  </div>

                  {/* Category 2: Valves */}
                  <div className="legend-category">
                    <div className="legend-category-title">Valve</div>
                    <div className="legend-sub-item">
                      <span className="legend-swatch swatch-valve-active" />
                      <span>Active</span>
                    </div>
                    <div className="legend-sub-item">
                      <span className="legend-swatch swatch-valve-maint" />
                      <span>Maintenance</span>
                    </div>
                    <div className="legend-sub-item">
                      <span className="legend-swatch swatch-valve-decom" />
                      <span>Decommissioned</span>
                    </div>
                  </div>

                  {/* Category 3: Hydrants */}
                  <div className="legend-category">
                    <div className="legend-category-title">Hydrant</div>
                    <div className="legend-sub-item">
                      <span className="legend-swatch swatch-hydrant-active" />
                      <span>Active</span>
                    </div>
                    <div className="legend-sub-item">
                      <span className="legend-swatch swatch-hydrant-maint" />
                      <span>Maintenance</span>
                    </div>
                    <div className="legend-sub-item">
                      <span className="legend-swatch swatch-hydrant-decom" />
                      <span>Decommissioned</span>
                    </div>
                  </div>

                  <div className="legend-footer">
                    Visible Assets: <strong>{assetCount}</strong>
                  </div>
                </div>
              ) : (
                <div className="summary-body">
                  <div className="summary-stat-row">
                    <span className="stat-label">Total Assets:</span>
                    <strong className="stat-value">{summary?.totalAssets ?? assetCount}</strong>
                  </div>
                  <div className="summary-stat-row">
                    <span className="stat-label">Pipe Length:</span>
                    <strong className="stat-value" style={{ color: '#38bdf8' }}>
                      {summary
                        ? `${summary.totalPipeLengthM.toLocaleString()} m (${(summary.totalPipeLengthM / 1000).toFixed(2)} km)`
                        : '...'}
                    </strong>
                  </div>

                  <div className="summary-divider" />

                  <div className="summary-section-label">By Category:</div>
                  <div className="summary-mini-grid">
                    <div className="mini-stat">
                      <span className="stat-sublabel">📏 Pipes:</span>
                      <strong>{summary?.pipesCount ?? 0}</strong>
                    </div>
                    <div className="mini-stat">
                      <span className="stat-sublabel">🚰 Valves:</span>
                      <strong>{summary?.valvesCount ?? 0}</strong>
                    </div>
                    <div className="mini-stat">
                      <span className="stat-sublabel">🚒 Hydrants:</span>
                      <strong>{summary?.hydrantsCount ?? 0}</strong>
                    </div>
                  </div>

                  <div className="summary-divider" />

                  <div className="summary-section-label">By Status:</div>
                  <div className="summary-mini-grid">
                    <div className="mini-stat">
                      <span className="stat-sublabel" style={{ color: '#34d399' }}>● Active:</span>
                      <strong>{summary?.activeCount ?? 0}</strong>
                    </div>
                    <div className="mini-stat">
                      <span className="stat-sublabel" style={{ color: '#fbbf24' }}>● Maint:</span>
                      <strong>{summary?.maintenanceCount ?? 0}</strong>
                    </div>
                    <div className="mini-stat">
                      <span className="stat-sublabel" style={{ color: '#94a3b8' }}>● Decom:</span>
                      <strong>{summary?.decommissionedCount ?? 0}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ArcGIS MapView */}
        <MapView
          mode={mode}
          addAssetSubtype={addAssetSubtype}
          filters={filters}
          selectedAsset={selectedAsset}
          selectedAssets={selectedAssets}
          validationReport={validationReport}
          refreshTrigger={refreshTrigger}
          zoomLocation={zoomLocation}
          onAssetSelect={(asset) => {
            setSelectedAsset(asset);
            setCreatePoint(null);
            setCreatePipeCoords(null);
            setShowSelectionTable(false);
            setShowValidationList(false);
          }}
          onAssetsLoaded={(count, capped) => {
            setAssetCount(count);
            setIsCapped(capped);
          }}
          onLoadingChange={(loading) => setIsLoading(loading)}
          onMapClickPoint={(coords) => {
            setCreatePoint(coords);
            setCreatePipeCoords(null);
            setSelectedAsset(null);
            setShowSelectionTable(false);
            setShowValidationList(false);
          }}
          onPipeDrawn={(coords) => {
            setCreatePipeCoords(coords);
            setCreatePoint(null);
            setSelectedAsset(null);
            setShowSelectionTable(false);
            setShowValidationList(false);
          }}
          onPolygonDrawn={async (poly) => {
            setIsLoading(true);
            try {
              const matching = await api.queryWithin(poly);
              setSelectedAssets(matching);
              setShowSelectionTable(true);
              setShowValidationList(false);
              setSelectedAsset(null);
              setCreatePoint(null);
              setCreatePipeCoords(null);
            } catch (err: any) {
              alert(`Selection query failed: ${err.message}`);
            } finally {
              setIsLoading(false);
            }
          }}
        />

        {/* Asset Details & Editing Side Panel (Phase 9 - F2) */}
        {selectedAsset && (
          <AssetForm
            asset={selectedAsset}
            onClose={() => setSelectedAsset(null)}
            onSaveSuccess={(updated) => {
              setSelectedAsset(updated);
              setRefreshTrigger((prev) => prev + 1);
              loadSummary();
            }}
            onDeleteSuccess={() => {
              setSelectedAsset(null);
              setRefreshTrigger((prev) => prev + 1);
              loadSummary();
            }}
          />
        )}

        {/* Add Point Asset Side Panel (Phase 10 - F3) */}
        {createPoint && (
          <AssetForm
            initialPoint={createPoint}
            onClose={() => setCreatePoint(null)}
            onSaveSuccess={(created) => {
              setCreatePoint(null);
              setMode('VIEW');
              setSelectedAsset(created);
              setRefreshTrigger((prev) => prev + 1);
              loadSummary();
            }}
          />
        )}

        {/* Add Pipe Asset Side Panel (Phase 11 - Pipe Drawing) */}
        {createPipeCoords && (
          <AssetForm
            initialPipeCoordinates={createPipeCoords}
            onClose={() => setCreatePipeCoords(null)}
            onSaveSuccess={(created) => {
              setCreatePipeCoords(null);
              setMode('VIEW');
              setSelectedAsset(created);
              setRefreshTrigger((prev) => prev + 1);
              loadSummary();
            }}
          />
        )}

        {/* Polygon Selected Assets Table (Phase 10 - F4) */}
        {showSelectionTable && selectedAssets.length > 0 && (
          <SelectionTable
            assets={selectedAssets}
            onClose={() => {
              setShowSelectionTable(false);
              setSelectedAssets([]);
            }}
            onAssetClick={handleSelectTableRowClick}
          />
        )}

        {/* Topological Validation Issues List (Phase 10 - F5) */}
        {showValidationList && validationReport && (
          <ValidationList
            report={validationReport}
            onClose={handleClearIssues}
            onIssueClick={handleIssueRowClick}
          />
        )}
      </div>
    </div>
  );
}
