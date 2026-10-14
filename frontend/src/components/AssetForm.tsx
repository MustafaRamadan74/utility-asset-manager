'use client';

import React, { useState, useEffect } from 'react';
import { Asset, AssetStatus, AssetType } from '../types/asset';
import { api, ApiError } from '../lib/api';

interface AssetFormProps {
  asset: Asset;
  onClose: () => void;
  onSaveSuccess: (updatedAsset: Asset) => void;
  onDeleteSuccess: (deletedId: string) => void;
}

export default function AssetForm({
  asset,
  onClose,
  onSaveSuccess,
  onDeleteSuccess,
}: AssetFormProps) {
  const [name, setName] = useState(asset.name);
  const [status, setStatus] = useState<AssetStatus>(asset.status);
  const [diameterMm, setDiameterMm] = useState<string>(
    asset.diameter_mm !== null && asset.diameter_mm !== undefined
      ? asset.diameter_mm.toString()
      : '',
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync state whenever selected asset changes
  useEffect(() => {
    setName(asset.name);
    setStatus(asset.status);
    setDiameterMm(
      asset.diameter_mm !== null && asset.diameter_mm !== undefined
        ? asset.diameter_mm.toString()
        : '',
    );
    setErrorMessages([]);
    setSuccessMessage(null);
  }, [asset]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessages([]);
    setSuccessMessage(null);

    // Client-side quick validation
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessages(['Asset name cannot be empty']);
      return;
    }

    const payload: {
      name: string;
      status: AssetStatus;
      diameter_mm?: number;
    } = {
      name: trimmedName,
      status,
    };

    if (asset.type === 'PIPE') {
      const parsedDiameter = parseInt(diameterMm, 10);
      if (isNaN(parsedDiameter) || parsedDiameter <= 0) {
        setErrorMessages(['Diameter is required and must be a positive integer for pipes']);
        return;
      }
      payload.diameter_mm = parsedDiameter;
    }

    setIsSaving(true);
    try {
      const updated = await api.updateAsset(asset.id, payload);
      setSuccessMessage('Asset updated successfully');
      onSaveSuccess(updated);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessages(err.messages);
      } else {
        setErrorMessages([err.message || 'Failed to update asset']);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete asset "${asset.name}" (${asset.id})?\nThis action cannot be undone.`,
    );
    if (!confirmed) return;

    setErrorMessages([]);
    setIsDeleting(true);
    try {
      await api.deleteAsset(asset.id);
      onDeleteSuccess(asset.id);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessages(err.messages);
      } else {
        setErrorMessages([err.message || 'Failed to delete asset']);
      }
      setIsDeleting(false);
    }
  };

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

  const formatGeometry = () => {
    if (!asset.geometry) return 'None';
    if (asset.geometry.type === 'Point') {
      const [lng, lat] = asset.geometry.coordinates;
      return `Point [${lng.toFixed(5)}, ${lat.toFixed(5)}]`;
    }
    if (asset.geometry.type === 'LineString') {
      return `LineString (${asset.geometry.coordinates.length} vertices)`;
    }
    return 'Unknown';
  };

  return (
    <aside className="side-drawer" aria-label="Asset Details">
      {/* Header */}
      <div className="drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={getBadgeClass(asset.type)}>{asset.type}</span>
          <span className="drawer-title" title={asset.name}>
            {asset.name}
          </span>
        </div>
        <button
          type="button"
          className="drawer-close-btn"
          onClick={onClose}
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Content Form */}
      <div className="drawer-content">
        {/* Error notification banner */}
        {errorMessages.length > 0 && (
          <div className="form-errors-box" role="alert">
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', color: '#f43f5e' }}>
              Validation Error ({errorMessages.length})
            </div>
            {errorMessages.map((msg, idx) => (
              <div key={idx} className="form-error-item">
                • {msg}
              </div>
            ))}
          </div>
        )}

        {/* Success message banner */}
        {successMessage && (
          <div className="form-success-box" role="status">
            <span>✓</span> {successMessage}
          </div>
        )}

        {/* Read-only asset metadata */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Asset ID:</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-dim)',
                fontSize: '11px',
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={asset.id}
            >
              {asset.id}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Location:</span>
            <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {formatGeometry()}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Last Updated:</span>
            <span style={{ color: 'var(--text-dim)' }}>
              {new Date(asset.updated_at).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSave}>
          {/* Asset Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="asset-name-input">
              Asset Name <span style={{ color: '#f43f5e' }}>*</span>
            </label>
            <input
              id="asset-name-input"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main Distribution Pipe 01"
              required
              disabled={isSaving || isDeleting}
            />
          </div>

          {/* Status */}
          <div className="form-group">
            <label className="form-label" htmlFor="asset-status-select">
              Network Status
            </label>
            <select
              id="asset-status-select"
              className="form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as AssetStatus)}
              disabled={isSaving || isDeleting}
            >
              <option value="ACTIVE">ACTIVE (Operational)</option>
              <option value="MAINTENANCE">MAINTENANCE (Under Repair)</option>
              <option value="DECOMMISSIONED">DECOMMISSIONED (Retired)</option>
            </select>
          </div>

          {/* Diameter (Conditional for PIPE per D2/D5) */}
          {asset.type === 'PIPE' && (
            <div className="form-group">
              <label className="form-label" htmlFor="asset-diameter-input">
                Pipe Diameter (mm) <span style={{ color: '#f43f5e' }}>*</span>
              </label>
              <input
                id="asset-diameter-input"
                type="number"
                min="1"
                step="1"
                className="form-input"
                value={diameterMm}
                onChange={(e) => setDiameterMm(e.target.value)}
                placeholder="e.g. 150"
                required
                disabled={isSaving || isDeleting}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Required positive integer (&gt; 0 mm)
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px' }}>
            <button
              type="submit"
              className="btn-action btn-primary"
              style={{ justifyContent: 'center', width: '100%', padding: '10px' }}
              disabled={isSaving || isDeleting}
            >
              {isSaving ? (
                <>
                  <div className="spinner" /> Saving Changes...
                </>
              ) : (
                '💾 Save Changes'
              )}
            </button>

            <button
              type="button"
              className="btn-action btn-danger"
              style={{ justifyContent: 'center', width: '100%', padding: '10px' }}
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
            >
              {isDeleting ? (
                <>
                  <div className="spinner" /> Deleting Asset...
                </>
              ) : (
                '🗑️ Delete Asset'
              )}
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}
