'use client';

import React, { useEffect, useRef } from 'react';
import Map from '@arcgis/core/Map';
import Basemap from '@arcgis/core/Basemap';
import MapView from '@arcgis/core/views/MapView';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import * as webMercatorUtils from '@arcgis/core/geometry/support/webMercatorUtils';
import Point from '@arcgis/core/geometry/Point';
import Graphic from '@arcgis/core/Graphic';

import {
  Asset,
  AssetStatus,
  AssetType,
  GeoJSONPolygon,
  InteractionMode,
  ValidationReport,
} from '../types/asset';
import { api } from '../lib/api';
import {
  assetToGraphic,
  assetToSelectionGraphic,
  extentToBbox,
  issueToGraphic,
} from '../lib/geo';

interface MapViewComponentProps {
  mode: InteractionMode;
  addAssetSubtype?: 'POINT' | 'PIPE';
  filters: { type?: AssetType; status?: AssetStatus };
  selectedAsset: Asset | null;
  selectedAssets: Asset[];
  validationReport: ValidationReport | null;
  refreshTrigger: number;
  onAssetSelect: (asset: Asset | null) => void;
  onAssetsLoaded: (count: number, isCapped: boolean) => void;
  onLoadingChange: (loading: boolean) => void;
  onMapClickPoint?: (coord: [number, number]) => void;
  onPipeDrawn?: (coordinates: [number, number][]) => void;
  onPolygonDrawn?: (polygon: GeoJSONPolygon) => void;
  zoomLocation?: { center: [number, number]; zoom?: number; timestamp: number } | null;
}

interface SnapCandidate {
  lng: number;
  lat: number;
  label: string;
}

function getDistanceMeters(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MapViewComponent({
  mode,
  addAssetSubtype = 'POINT',
  filters,
  selectedAsset,
  selectedAssets,
  validationReport,
  refreshTrigger,
  zoomLocation,
  onAssetSelect,
  onAssetsLoaded,
  onLoadingChange,
  onMapClickPoint,
  onPipeDrawn,
  onPolygonDrawn,
}: MapViewComponentProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const assetsLayerRef = useRef<GraphicsLayer | null>(null);
  const selectionLayerRef = useRef<GraphicsLayer | null>(null);
  const issuesLayerRef = useRef<GraphicsLayer | null>(null);
  const snapLayerRef = useRef<GraphicsLayer | null>(null);
  const sketchVmRef = useRef<SketchViewModel | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Snapping candidates and active snap target
  const snapCandidatesRef = useRef<SnapCandidate[]>([]);
  const activeSnapPointRef = useRef<[number, number] | null>(null);

  // Keep latest props in refs for event callbacks
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const addAssetSubtypeRef = useRef(addAssetSubtype);
  addAssetSubtypeRef.current = addAssetSubtype;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const onMapClickPointRef = useRef(onMapClickPoint);
  onMapClickPointRef.current = onMapClickPoint;
  const onPipeDrawnRef = useRef(onPipeDrawn);
  onPipeDrawnRef.current = onPipeDrawn;
  const onPolygonDrawnRef = useRef(onPolygonDrawn);
  onPolygonDrawnRef.current = onPolygonDrawn;

  const updateSnapCandidates = (assets: Asset[]) => {
    const candidates: SnapCandidate[] = [];
    for (const a of assets) {
      if (a.geometry.type === 'Point') {
        candidates.push({
          lng: a.geometry.coordinates[0],
          lat: a.geometry.coordinates[1],
          label: `${a.type} (${a.name})`,
        });
      } else if (a.geometry.type === 'LineString') {
        const coords = a.geometry.coordinates;
        if (coords.length > 0) {
          candidates.push({
            lng: coords[0][0],
            lat: coords[0][1],
            label: `Pipe Start (${a.name})`,
          });
          candidates.push({
            lng: coords[coords.length - 1][0],
            lat: coords[coords.length - 1][1],
            label: `Pipe End (${a.name})`,
          });
        }
      }
    }
    snapCandidatesRef.current = candidates;
  };

  // Initialize MapView once on mount
  useEffect(() => {
    if (!mapDivRef.current) return;

    // 1. Basemap using OpenStreetMap WebTileLayer (no API token required)
    const osmLayer = new WebTileLayer({
      urlTemplate:
        'https://{subDomain}.tile.openstreetmap.org/{level}/{col}/{row}.png',
      subDomains: ['a', 'b', 'c'],
      copyright: '© OpenStreetMap contributors (Demo Use Only)',
    });

    // 2. Separate Graphics Layers + Snapping Layer
    const assetsLayer = new GraphicsLayer({ title: 'Assets Layer' });
    const selectionLayer = new GraphicsLayer({ title: 'Selection Layer' });
    const issuesLayer = new GraphicsLayer({ title: 'Issues Layer' });
    const snapLayer = new GraphicsLayer({ title: 'Snap Layer' });

    assetsLayerRef.current = assetsLayer;
    selectionLayerRef.current = selectionLayer;
    issuesLayerRef.current = issuesLayer;
    snapLayerRef.current = snapLayer;

    // 3. Map with OSM basemap and graphic layers
    const basemap = new Basemap({
      baseLayers: [osmLayer],
      title: 'OpenStreetMap',
      id: 'osm-basemap',
    });

    const map = new Map({
      basemap,
      layers: [assetsLayer, selectionLayer, issuesLayer, snapLayer],
    });

    // 4. MapView without zoom buttons and without compass as requested
    const view = new MapView({
      container: mapDivRef.current,
      map,
      center: [31.762, 30.021],
      zoom: 16,
      ui: {
        components: [], // Compass and Zoom in/out buttons removed
      },
    });
    viewRef.current = view;

    // 5. SketchViewModel for drawing polygons & pipes
    const sketchVM = new SketchViewModel({
      view,
      layer: selectionLayer,
      polygonSymbol: {
        type: 'simple-fill',
        color: [0, 229, 255, 0.2],
        outline: {
          color: [0, 229, 255, 1],
          width: 2,
        },
      } as any,
      polylineSymbol: {
        type: 'simple-line',
        color: [56, 189, 248, 1],
        width: 4,
      } as any,
    });
    sketchVmRef.current = sketchVM;

    sketchVM.on('create', (event: any) => {
      const geom = event.graphic?.geometry || event.geometry;
      if (event.state === 'complete' && geom) {
        if (geom.type === 'polygon') {
          const polyGeom = geom as __esri.Polygon;
          const geoPoly = webMercatorUtils.webMercatorToGeographic(
            polyGeom,
          ) as __esri.Polygon;

          // Convert to GeoJSON Polygon order [[[lng, lat], ...]]
          const coordinates = geoPoly.rings.map((ring: number[][]) =>
            ring.map(([x, y]) => [
              parseFloat(x.toFixed(6)),
              parseFloat(y.toFixed(6)),
            ]),
          );

          if (onPolygonDrawnRef.current) {
            onPolygonDrawnRef.current({
              type: 'Polygon',
              coordinates: coordinates as any,
            });
          }
        } else if (geom.type === 'polyline') {
          const polylineGeom = geom as __esri.Polyline;
          const geoLine = webMercatorUtils.webMercatorToGeographic(
            polylineGeom,
          ) as __esri.Polyline;

          if (geoLine && geoLine.paths && geoLine.paths.length > 0) {
            const rawCoords = geoLine.paths[0].map(([x, y]) => [
              parseFloat(x.toFixed(6)),
              parseFloat(y.toFixed(6)),
            ]);

            // Filter out duplicate consecutive points (Validation: duplicate points rule)
            const deduplicatedCoords: [number, number][] = [];
            for (const pt of rawCoords) {
              if (deduplicatedCoords.length === 0) {
                deduplicatedCoords.push([pt[0], pt[1]]);
              } else {
                const prev = deduplicatedCoords[deduplicatedCoords.length - 1];
                if (
                  Math.abs(prev[0] - pt[0]) > 0.000001 ||
                  Math.abs(prev[1] - pt[1]) > 0.000001
                ) {
                  deduplicatedCoords.push([pt[0], pt[1]]);
                }
              }
            }

            // Snapping tolerance check for start and end vertices (1-5m)
            for (const c of snapCandidatesRef.current) {
              if (
                getDistanceMeters(
                  deduplicatedCoords[0][0],
                  deduplicatedCoords[0][1],
                  c.lng,
                  c.lat,
                ) <= 5.0
              ) {
                deduplicatedCoords[0] = [c.lng, c.lat];
                break;
              }
            }
            const lastIdx = deduplicatedCoords.length - 1;
            for (const c of snapCandidatesRef.current) {
              if (
                getDistanceMeters(
                  deduplicatedCoords[lastIdx][0],
                  deduplicatedCoords[lastIdx][1],
                  c.lng,
                  c.lat,
                ) <= 5.0
              ) {
                deduplicatedCoords[lastIdx] = [c.lng, c.lat];
                break;
              }
            }

            // Zero-length pipes validation (at least 2 distinct points required)
            if (deduplicatedCoords.length < 2) {
              alert(
                'Invalid pipe: Pipe must have at least 2 distinct points (zero-length pipes are not allowed)',
              );
              sketchVM.create('polyline');
              return;
            }

            if (onPipeDrawnRef.current) {
              onPipeDrawnRef.current(deduplicatedCoords);
            }
          }
        }
      }
    });

    // 6. Extent stationary watcher: Reload assets on pan/zoom
    const stationaryHandle = view.watch('stationary', async (stationary) => {
      if (!stationary || !view.extent) return;

      // Abort any pending fetch request
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }

      const controller = new AbortController();
      activeAbortControllerRef.current = controller;
      onLoadingChange(true);

      try {
        const bbox = extentToBbox(view.extent);
        const assets = await api.getAssetsByBBox(
          bbox,
          filtersRef.current,
          controller.signal,
        );

        // Update assets graphics
        if (assetsLayerRef.current) {
          assetsLayerRef.current.removeAll();
          const graphics = assets.map((a) => assetToGraphic(a));
          assetsLayerRef.current.addMany(graphics);
        }

        updateSnapCandidates(assets);

        const isCapped = assets.length >= 5000;
        onAssetsLoaded(assets.length, isCapped);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // Stale request aborted - expected behaviour
          return;
        }
        console.error('Failed to load assets for extent:', err);
      } finally {
        onLoadingChange(false);
      }
    });

    // 7. Interactive Snapping watcher on pointer-move (1 to 5 meters tolerance)
    const pointerMoveHandle = view.on('pointer-move', (event) => {
      if (modeRef.current !== 'ADD_ASSET') {
        if (activeSnapPointRef.current) {
          activeSnapPointRef.current = null;
          snapLayerRef.current?.removeAll();
        }
        return;
      }

      const mapPoint = view.toMap({ x: event.x, y: event.y });
      if (!mapPoint) return;

      const geoPoint = webMercatorUtils.webMercatorToGeographic(
        mapPoint,
      ) as Point;
      const currentLng = geoPoint.longitude;
      const currentLat = geoPoint.latitude;

      let nearestCandidate: SnapCandidate | null = null;
      let minDistance = 5.0; // 5 meters tolerance

      for (const c of snapCandidatesRef.current) {
        const dist = getDistanceMeters(currentLng, currentLat, c.lng, c.lat);
        if (dist <= minDistance) {
          minDistance = dist;
          nearestCandidate = c;
        }
      }

      if (nearestCandidate) {
        activeSnapPointRef.current = [nearestCandidate.lng, nearestCandidate.lat];
        if (snapLayerRef.current) {
          snapLayerRef.current.removeAll();
          const snapGraphic = new Graphic({
            geometry: new Point({
              longitude: nearestCandidate.lng,
              latitude: nearestCandidate.lat,
            }),
            symbol: {
              type: 'simple-marker',
              style: 'circle',
              color: [56, 189, 248, 0.4],
              size: 22,
              outline: {
                color: [245, 158, 11, 1],
                width: 2.5,
              },
            } as any,
          });

          const textGraphic = new Graphic({
            geometry: new Point({
              longitude: nearestCandidate.lng,
              latitude: nearestCandidate.lat,
            }),
            symbol: {
              type: 'text',
              text: `🧲 Snapped (${minDistance.toFixed(1)}m)`,
              color: '#38bdf8',
              haloColor: '#0f172a',
              haloSize: 2,
              font: {
                size: 11,
                weight: 'bold',
                family: 'Inter, sans-serif',
              },
              yoffset: 16,
            } as any,
          });

          snapLayerRef.current.addMany([snapGraphic, textGraphic]);
        }
      } else {
        if (activeSnapPointRef.current) {
          activeSnapPointRef.current = null;
          snapLayerRef.current?.removeAll();
        }
      }
    });

    // 8. Click listener handling interaction modes
    const clickHandle = view.on('click', async (event) => {
      const currentMode = modeRef.current;

      if (currentMode === 'VIEW') {
        // HitTest on clicked graphics
        const response = await view.hitTest(event);
        if (response.results && response.results.length > 0) {
          for (const res of response.results) {
            const g = (res as any).graphic;
            if (g && g.attributes && g.attributes.id) {
              const attr = { ...g.attributes };
              if (attr.rawGeometry) {
                try {
                  attr.geometry = JSON.parse(attr.rawGeometry);
                } catch {}
              }
              onAssetSelect(attr as Asset);
              return;
            }
          }
        }
        onAssetSelect(null);
      } else if (
        currentMode === 'ADD_ASSET' &&
        addAssetSubtypeRef.current === 'POINT'
      ) {
        // Point placement for creating asset - snap if near candidate
        if (activeSnapPointRef.current && onMapClickPointRef.current) {
          onMapClickPointRef.current(activeSnapPointRef.current);
        } else {
          const geoPoint = webMercatorUtils.webMercatorToGeographic(
            event.mapPoint,
          ) as Point;
          const lng = parseFloat(geoPoint.longitude.toFixed(6));
          const lat = parseFloat(geoPoint.latitude.toFixed(6));
          if (onMapClickPointRef.current) {
            onMapClickPointRef.current([lng, lat]);
          }
        }
      }
    });

    // Cleanup: Destroy MapView on component unmount
    return () => {
      stationaryHandle.remove();
      pointerMoveHandle.remove();
      clickHandle.remove();
      if (sketchVmRef.current) sketchVmRef.current.destroy();
      if (view) view.destroy();
    };
  }, []); // Run once on mount

  // Watch interaction mode changes (Sketch activation & cursor styling)
  useEffect(() => {
    if (mapDivRef.current) {
      mapDivRef.current.style.cursor =
        mode === 'ADD_ASSET' ? 'crosshair' : 'default';
    }
    if (!sketchVmRef.current) return;
    if (mode === 'DRAW_POLYGON') {
      sketchVmRef.current.create('polygon');
    } else if (mode === 'ADD_ASSET' && addAssetSubtype === 'PIPE') {
      sketchVmRef.current.create('polyline');
    } else {
      sketchVmRef.current.cancel();
    }
  }, [mode, addAssetSubtype]);

  // Watch programmatic zoom requests (focusing on an asset or validation issue)
  useEffect(() => {
    if (!zoomLocation || !viewRef.current) return;
    viewRef.current.goTo({
      center: zoomLocation.center,
      zoom: zoomLocation.zoom || 18,
    });
  }, [zoomLocation]);

  // Update selection highlight layer
  useEffect(() => {
    if (!selectionLayerRef.current) return;
    selectionLayerRef.current.removeAll();

    if (selectedAsset) {
      const g = assetToSelectionGraphic(selectedAsset);
      if (g) selectionLayerRef.current.add(g);
    }
    if (selectedAssets && selectedAssets.length > 0) {
      const graphics = selectedAssets
        .map((a) => assetToSelectionGraphic(a))
        .filter((g): g is Graphic => g !== null);
      if (graphics.length > 0) {
        selectionLayerRef.current.addMany(graphics);
      }
    }
  }, [selectedAsset, selectedAssets]);

  // Update validation issues layer
  useEffect(() => {
    if (!issuesLayerRef.current) return;
    issuesLayerRef.current.removeAll();

    if (validationReport?.features) {
      const graphics = validationReport.features.map((f) => issueToGraphic(f));
      issuesLayerRef.current.addMany(graphics);
    }
  }, [validationReport]);

  // Trigger manual refresh on filter change or refreshTrigger
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !view.extent) return;

    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;
    onLoadingChange(true);

    const bbox = extentToBbox(view.extent);
    api
      .getAssetsByBBox(bbox, filters, controller.signal)
      .then((assets) => {
        if (assetsLayerRef.current) {
          assetsLayerRef.current.removeAll();
          assetsLayerRef.current.addMany(assets.map(assetToGraphic));
        }
        updateSnapCandidates(assets);
        onAssetsLoaded(assets.length, assets.length >= 5000);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Refresh failed:', err);
        }
      })
      .finally(() => {
        onLoadingChange(false);
      });
  }, [filters, refreshTrigger]);

  return <div ref={mapDivRef} className="map-viewport" />;
}
