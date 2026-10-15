'use client';

import React from 'react';
import { ValidationFeature, ValidationReport, ValidationRule } from '../types/asset';

interface ValidationListProps {
  report: ValidationReport;
  onClose: () => void;
  onIssueClick: (feature: ValidationFeature) => void;
}

export default function ValidationList({
  report,
  onClose,
  onIssueClick,
}: ValidationListProps) {
  const getRuleBadgeClass = (rule: ValidationRule) => {
    switch (rule) {
      case 'VALVE_NOT_ON_PIPE':
        return 'badge badge-rule-valve';
      case 'DANGLING_PIPE_END':
        return 'badge badge-rule-pipe';
      default:
        return 'badge';
    }
  };

  const getRuleIcon = (rule: ValidationRule) => {
    return rule === 'VALVE_NOT_ON_PIPE' ? '⚠️' : '❌';
  };

  return (
    <aside className="side-drawer-wide" aria-label="Topological Validation Report">
      {/* Header */}
      <div className="drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="badge"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: '12px',
            }}
          >
            {report.features.length} Issues Found
          </span>
          <span className="drawer-title">Validation Report</span>
        </div>
        <button
          type="button"
          className="drawer-close-btn"
          onClick={onClose}
          aria-label="Close validation panel"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="drawer-content" style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '14px',
            fontSize: '12px',
            color: 'var(--text-dim)',
            lineHeight: 1.5,
          }}
        >
          Topological network rules verified via PostGIS spatial predicates (1m tolerance on spheroid):
          <br />
          • <strong>VALVE_NOT_ON_PIPE</strong> (Valve &gt; 1m from any pipe)
          <br />
          • <strong>DANGLING_PIPE_END</strong> (Pipe endpoint unconnected)
        </div>

        {report.features.length === 0 ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              color: '#34d399',
              fontSize: '13px',
              border: '1px dashed rgba(52, 211, 153, 0.3)',
              borderRadius: '8px',
            }}
          >
            ✓ All topological rules passed! No network errors detected.
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {report.features.map((feature, idx) => {
              const { rule, message, asset_ids } = feature.properties;
              const [lng, lat] = feature.geometry.coordinates;
              const cardClass =
                rule === 'VALVE_NOT_ON_PIPE'
                  ? 'issue-card rule-valve'
                  : 'issue-card rule-pipe';

              return (
                <div
                  key={idx}
                  className={cardClass}
                  onClick={() => onIssueClick(feature)}
                  title="Click to zoom to this issue on the map"
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                    }}
                  >
                    <span className={getRuleBadgeClass(rule)}>
                      {getRuleIcon(rule)} {rule}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--primary)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      Focus 🔍
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--text-main)',
                      marginBottom: '6px',
                    }}
                  >
                    {message}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <span>Asset: {asset_ids.join(', ')}</span>
                    <span>[{lng.toFixed(5)}, {lat.toFixed(5)}]</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-action"
            onClick={onClose}
          >
            Clear Issues
          </button>
        </div>
      </div>
    </aside>
  );
}
