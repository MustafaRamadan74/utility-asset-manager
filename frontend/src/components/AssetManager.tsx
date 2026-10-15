'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { api, ApiError } from '../lib/api';
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

interface ToastNotification {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  reason?: string;
}

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

  // Undo status state
  const [undoStatus, setUndoStatus] = useState<{
    canUndo: boolean;
    lastAction?: string;
    lastAssetName?: string;
  }>({ canUndo: false });

  // 5-second Toast Notification state
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message?: string,
    reason?: string,
  ) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ id: Date.now(), type, title, message, reason });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 5000); // exactly 5 seconds duration as requested
  };

  const [filters, setFilters] = useState<{
    type?: AssetType;
    status?: AssetStatus;
  }>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch summary data
  const loadSummary = async () => {
    try {
      const data = await api.getSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load network summary:', err);
    }
  };

  // Fetch undo status
  const loadUndoStatus = async () => {
    try {
      const status = await api.getUndoStatus();
      setUndoStatus(status);
    } catch (err) {
      console.error('Failed to check undo status:', err);
    }
  };

  useEffect(() => {
    loadSummary();
    loadUndoStatus();
  }, [refreshTrigger]);

  const handleUndo = async () => {
    setIsLoading(true);
    try {
      const res = await api.undo();
      showToast('success', 'Operation Undone', res.message);
      setRefreshTrigger((prev) => prev + 1);
      loadSummary();
      loadUndoStatus();
      if (res.asset) {
        setSelectedAsset(res.asset);
      }
    } catch (err: any) {
      const reason =
        err instanceof ApiError ? err.messages.join(', ') : err.message;
      showToast('error', 'Undo Failed', undefined, reason);
    } finally {
      setIsLoading(false);
    }
  };

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
      showToast(
        'info',
        'Topological Validation',
        `Analyzed network: found ${report.features.length} issue(s).`,
      );
    } catch (err: any) {
      const reason =
        err instanceof ApiError ? err.messages.join(', ') : err.message;
      showToast('error', 'Validation Failed', undefined, reason);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearIssues = () => {
    setValidationReport(null);
    setShowValidationList(false);
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
      {/* 5-Second Operation Toast Notification */}
      {toast && (
        <div className={`floating-toast toast-${toast.type}`} role="alert">
          <div className="toast-icon">
            {toast.type === 'success'
              ? '✓'
              : toast.type === 'error'
                ? '✕'
                : '⚠️'}
          </div>
          <div className="toast-body">
            <div className="toast-title">{toast.title}</div>
            {toast.message && (
              <div className="toast-message">{toast.message}</div>
            )}
            {toast.reason && (
              <div className="toast-reason">Reason: {toast.reason}</div>
            )}
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToast(null)}
            aria-label="Close notification"
          >
            ✕
          </button>
          <div className="toast-progress-bar" />
        </div>
      )}

      {/* Header Bar */}
      <header className="app-header">
        {/* Left: Brand Section */}
        <div className="brand-section">
          <div className="brand-title">Utility Asset Manager</div>
        </div>

        {/* Center: Exactly Centered Mode Buttons (Align Center without overflow) */}
        <div className="navbar-center-controls desktop-only">
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
                title="Click on map to place a Valve or Hydrant point (snapping enabled)"
              >
                📍 Point
              </button>
              <button
                className={`btn-toggle ${addAssetSubtype === 'PIPE' ? 'active' : ''}`}
                onClick={() => setAddAssetSubtype('PIPE')}
                title="Click and double-click to draw a Pipe (snapping enabled)"
              >
                📏 Pipe
              </button>
            </div>
          )}
        </div>

        {/* Right: Actions, Filters & Undo */}
        <div className="navbar-right-controls desktop-only">
          {/* Undo Action Button */}
          <button
            className="btn-undo"
            onClick={handleUndo}
            disabled={isLoading || !undoStatus.canUndo}
            title={
              undoStatus.canUndo
                ? `Undo last action: ${undoStatus.lastAction} ${undoStatus.lastAssetName || ''}`
                : 'No actions to undo'
            }
          >
            ↩️ Undo
          </button>

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
            🛡️ Validation
          </button>

          {validationReport && (
            <button className="btn-action" onClick={handleClearIssues}>
              Clear ({validationReport.features.length})
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

          <div className="mobile-section-label">History &amp; Actions</div>
          <button
            className="btn-undo"
            style={{ width: '100%', justifyContent: 'center', marginBottom: '8px' }}
            onClick={() => {
              handleUndo();
              setIsMobileMenuOpen(false);
            }}
            disabled={isLoading || !undoStatus.canUndo}
          >
            ↩️ Undo Last Change
          </button>

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
                ? '📏 Click to place vertices (snaps to points within 5m), double-click to finish'
                : '📍 Click anywhere to place point (🧲 Snapping active within 5m)'}
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
              showToast(
                'info',
                'Polygon Query',
                `Found ${matching.length} assets intersecting polygon.`,
              );
            } catch (err: any) {
              const reason =
                err instanceof ApiError ? err.messages.join(', ') : err.message;
              showToast('error', 'Polygon Query Failed', undefined, reason);
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
              loadUndoStatus();
              showToast(
                'success',
                'Asset Updated',
                `Asset "${updated.name}" was updated successfully.`,
              );
            }}
            onDeleteSuccess={(deletedId, assetName) => {
              setSelectedAsset(null);
              setRefreshTrigger((prev) => prev + 1);
              loadSummary();
              loadUndoStatus();
              showToast(
                'success',
                'Asset Deleted',
                `Asset "${assetName || deletedId}" was deleted. Click Undo to restore.`,
              );
            }}
            onError={(title, message) => {
              showToast('error', title, undefined, message);
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
              loadUndoStatus();
              showToast(
                'success',
                'Asset Created',
                `New ${created.type} "${created.name}" was successfully placed.`,
              );
            }}
            onError={(title, message) => {
              showToast('error', title, undefined, message);
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
              loadUndoStatus();
              showToast(
                'success',
                'Pipe Created',
                `New Pipe "${created.name}" (${created.diameter_mm}mm) was successfully drawn and saved.`,
              );
            }}
            onError={(title, message) => {
              showToast('error', title, undefined, message);
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
