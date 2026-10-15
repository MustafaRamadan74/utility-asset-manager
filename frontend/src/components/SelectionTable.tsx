'use client';

import React from 'react';
import { Asset, AssetType } from '../types/asset';

interface SelectionTableProps {
  assets: Asset[];
  onClose: () => void;
  onAssetClick: (asset: Asset) => void;
}

export default function SelectionTable({
  assets,
  onClose,
  onAssetClick,
}: SelectionTableProps) {
  const getBadgeClass = (type: AssetType) => {
    switch (type) {
      case 'PIPE':
        return 'badge badge-pipe';
      case 'VALVE':
        return 'badge badge-valve';
      case 'HYDRANT':
        return 'badge badge-hydrant';
      default:
        return 'badge';
    }
  };

  const getGeometryDetails = (asset: Asset) => {
    if (asset.type === 'PIPE') {
      return `${asset.diameter_mm || '-'} mm`;
    }
    const coords = (asset.geometry as any).coordinates;
    return `[${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}]`;
  };

  return (
    <aside className="side-drawer-wide" aria-label="Polygon Selected Assets">
      {/* Header */}
      <div className="drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-pipe" style={{ fontSize: '12px' }}>
            {assets.length} Selected
          </span>
          <span className="drawer-title">Polygon Selection</span>
        </div>
        <button
          type="button"
          className="drawer-close-btn"
          onClick={onClose}
          aria-label="Close selection panel"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="drawer-content" style={{ display: 'flex', flexDirection: 'column' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '12px' }}>
          Assets intersecting user-drawn polygon via <code>ST_Intersects</code> and <code>ST_MakeValid</code>. Click any row to focus on map.
        </p>

        {assets.length === 0 ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px',
              border: '1px dashed var(--border-subtle)',
              borderRadius: '8px',
            }}
          >
            No assets found inside the drawn polygon.
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Detail</th>
                  <th style={{ width: '40px', textAlign: 'center' }}>Focus</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => onAssetClick(asset)}
                    title="Click to zoom to asset"
                  >
                    <td>
                      <span className={getBadgeClass(asset.type)}>
                        {asset.type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{asset.name}</td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          color:
                            asset.status === 'ACTIVE'
                              ? '#34d399'
                              : asset.status === 'MAINTENANCE'
                              ? '#fbbf24'
                              : '#94a3b8',
                        }}
                      >
                        {asset.status}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)' }}>
                      {getGeometryDetails(asset)}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '14px' }}>
                      🔍
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-action"
            onClick={onClose}
          >
            Clear Selection
          </button>
        </div>
      </div>
    </aside>
  );
}
