'use client';

import React, { useState, useEffect } from 'react';
import { Asset, AssetStatus, AssetType } from '../types/asset';
import { api, ApiError } from '../lib/api';

interface AssetFormProps {
  asset?: Asset | null;
  initialPoint?: [number, number] | null;
  initialPipeCoordinates?: [number, number][] | null;
  onClose: () => void;
  onSaveSuccess: (savedAsset: Asset) => void;
  onDeleteSuccess?: (deletedId: string, assetName?: string) => void;
  onError?: (title: string, message: string) => void;
}

export default function AssetForm({
  asset,
  initialPoint,
  initialPipeCoordinates,
  onClose,
  onSaveSuccess,
  onDeleteSuccess,
  onError,
}: AssetFormProps) {
  const isCreateMode = !asset && (!!initialPoint || !!initialPipeCoordinates);
  const isCreatingPipe = !asset && !!initialPipeCoordinates;

  const [type, setType] = useState<AssetType>(
    isCreatingPipe ? 'PIPE' : asset?.type || 'VALVE',
  );
  const [name, setName] = useState(asset?.name || '');
  const [status, setStatus] = useState<AssetStatus>(asset?.status || 'ACTIVE');
  const [diameterMm, setDiameterMm] = useState<string>(
    asset?.diameter_mm !== null && asset?.diameter_mm !== undefined
      ? asset.diameter_mm.toString()
      : isCreatingPipe
        ? '150'
        : '',
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync state whenever selected asset, initialPoint, or initialPipeCoordinates change
  useEffect(() => {
    if (asset) {
      setType(asset.type);
      setName(asset.name);
      setStatus(asset.status);
      setDiameterMm(
        asset.diameter_mm !== null && asset.diameter_mm !== undefined
          ? asset.diameter_mm.toString()
          : '',
      );
    } else if (initialPipeCoordinates) {
      setType('PIPE');
      setName('');
      setStatus('ACTIVE');
      setDiameterMm('150');
    } else if (initialPoint) {
      setType('VALVE');
      setName('');
      setStatus('ACTIVE');
      setDiameterMm('');
    }
    setErrorMessages([]);
    setSuccessMessage(null);
    setShowDeleteModal(false);
  }, [asset, initialPoint, initialPipeCoordinates]);

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

    setIsSaving(true);
    try {
      if (isCreateMode) {
        if (isCreatingPipe && initialPipeCoordinates) {
          const parsedDiameter = parseInt(diameterMm, 10);
          if (isNaN(parsedDiameter) || parsedDiameter <= 0) {
            setErrorMessages([
              'Diameter is required and must be a positive integer for pipes',
            ]);
            setIsSaving(false);
            return;
          }
          const newAsset = await api.createAsset({
            name: trimmedName,
            type: 'PIPE',
            status,
            diameter_mm: parsedDiameter,
            geometry: {
              type: 'LineString',
              coordinates: initialPipeCoordinates,
            },
          });
          setSuccessMessage('Pipe asset created successfully');
          onSaveSuccess(newAsset);
        } else if (initialPoint) {
          const newAsset = await api.createAsset({
            name: trimmedName,
            type,
            status,
            diameter_mm: null,
            geometry: {
              type: 'Point',
              coordinates: initialPoint,
            },
          });
          setSuccessMessage('Asset created successfully');
          onSaveSuccess(newAsset);
        }
      } else if (asset) {
        // Update existing asset (F2)
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
            setErrorMessages([
              'Diameter is required and must be a positive integer for pipes',
            ]);
            setIsSaving(false);
            return;
          }
          payload.diameter_mm = parsedDiameter;
        }

        const updated = await api.updateAsset(asset.id, payload);
        setSuccessMessage('Asset updated successfully');
        onSaveSuccess(updated);
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessages(err.messages);
      } else {
        setErrorMessages([err.message || 'Operation failed']);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!asset || !onDeleteSuccess) return;

    setErrorMessages([]);
    setIsDeleting(true);
    try {
      await api.deleteAsset(asset.id);
      setShowDeleteModal(false);
      onDeleteSuccess(asset.id, asset.name);
    } catch (err: any) {
      const msgs =
        err instanceof ApiError
          ? err.messages
          : [err.message || 'Failed to delete asset'];
      setErrorMessages(msgs);
      if (onError) {
        onError('Deletion Failed', msgs.join(', '));
      }
      setIsDeleting(false);
    }
  };

  const getBadgeClass = (t: AssetType) => {
    switch (t) {
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
    if (isCreateMode && initialPipeCoordinates) {
      return `LineString (${initialPipeCoordinates.length} vertices)`;
    }
    if (isCreateMode && initialPoint) {
      return `Point [${initialPoint[0].toFixed(5)}, ${initialPoint[1].toFixed(5)}]`;
    }
    if (!asset?.geometry) return 'None';
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
    <aside
      className="side-drawer"
      aria-label={isCreateMode ? 'Create Asset' : 'Asset Details'}
    >
      {/* Header */}
      <div className="drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={getBadgeClass(type)}>
            {isCreateMode ? `NEW ${type}` : type}
          </span>
          <span
            className="drawer-title"
            title={isCreateMode ? 'Add New Asset' : asset?.name}
          >
            {isCreateMode ? 'Add New Asset' : asset?.name}
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
            <div
              style={{
                fontWeight: 600,
                fontSize: '13px',
                marginBottom: '6px',
                color: '#f43f5e',
              }}
            >
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

        {/* Asset metadata / location */}
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
          {!isCreateMode && asset && (
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
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              {isCreateMode ? 'Target Location:' : 'Location:'}
            </span>
            <span
              style={{
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {formatGeometry()}
            </span>
          </div>
          {!isCreateMode && asset && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Last Updated:</span>
              <span style={{ color: 'var(--text-dim)' }}>
                {new Date(asset.updated_at).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Edit / Create Form */}
        <form onSubmit={handleSave}>
          {/* Asset Type (Selectable in create mode if point, fixed if pipe) */}
          {isCreateMode && (
            <div className="form-group">
              <label className="form-label" htmlFor="create-type-select">
                Asset Type <span style={{ color: '#f43f5e' }}>*</span>
              </label>
              {isCreatingPipe ? (
                <input
                  id="create-type-select"
                  type="text"
                  className="form-input"
                  value="PIPE (Water Distribution Line)"
                  disabled
                  style={{ opacity: 0.9, background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}
                />
              ) : (
                <select
                  id="create-type-select"
                  className="form-select"
                  value={type}
                  onChange={(e) => setType(e.target.value as AssetType)}
                  disabled={isSaving}
                >
                  <option value="VALVE">VALVE (Control Point)</option>
                  <option value="HYDRANT">HYDRANT (Fire Service Point)</option>
                </select>
              )}
            </div>
          )}

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
              placeholder={
                isCreatingPipe
                  ? 'e.g. Distribution Pipe P-22'
                  : isCreateMode
                    ? 'e.g. Valve V-12 or Hydrant H-15'
                    : 'Asset name'
              }
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
          {((isCreateMode && isCreatingPipe) || (!isCreateMode && asset?.type === 'PIPE')) && (
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
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginTop: '4px',
                  display: 'block',
                }}
              >
                Required positive integer (&gt; 0 mm)
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginTop: '24px',
            }}
          >
            <button
              type="submit"
              className="btn-action btn-primary"
              style={{
                justifyContent: 'center',
                width: '100%',
                padding: '10px',
              }}
              disabled={isSaving || isDeleting}
            >
              {isSaving ? (
                <>
                  <div className="spinner" />{' '}
                  {isCreateMode ? 'Creating Asset...' : 'Saving Changes...'}
                </>
              ) : isCreateMode ? (
                '➕ Create Asset'
              ) : (
                '💾 Save Changes'
              )}
            </button>

            {!isCreateMode && onDeleteSuccess && (
              <button
                type="button"
                className="btn-action btn-danger"
                style={{
                  justifyContent: 'center',
                  width: '100%',
                  padding: '10px',
                }}
                onClick={() => setShowDeleteModal(true)}
                disabled={isSaving || isDeleting}
              >
                🗑️ Delete Asset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Delete Confirmation Warning Modal in Screen Center */}
      {showDeleteModal && asset && (
        <div className="warning-modal-backdrop" role="dialog" aria-modal="true">
          <div className="warning-modal-card">
            <div className="warning-modal-badge">
              <span className="warning-pulse-icon">⚠️</span>
            </div>
            <h3 className="warning-modal-title">Confirm Asset Deletion</h3>
            <p className="warning-modal-text">
              Are you sure you want to delete{' '}
              <strong style={{ color: '#f8fafc' }}>"{asset.name}"</strong>?
            </p>
            <p className="warning-modal-subtext">
              Type: <strong>{asset.type}</strong> | Status: <strong>{asset.status}</strong>
              <br />
              This will remove the asset from the GIS network. You can undo this action immediately after.
            </p>
            <div className="warning-modal-actions">
              <button
                type="button"
                className="btn-action"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-action btn-danger"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <div className="spinner" /> Deleting...
                  </>
                ) : (
                  '🗑️ Yes, Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
