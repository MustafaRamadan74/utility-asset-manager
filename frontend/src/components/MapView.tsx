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
  filters: { type?: AssetType; status?: AssetStatus };
  selectedAsset: Asset | null;
  selectedAssets: Asset[];
  validationReport: ValidationReport | null;
  refreshTrigger: number;
  onAssetSelect: (asset: Asset | null) => void;
  onAssetsLoaded: (count: number, isCapped: boolean) => void;
  onLoadingChange: (loading: boolean) => void;
  onMapClickPoint?: (coord: [number, number]) => void;
  onPolygonDrawn?: (polygon: GeoJSONPolygon) => void;
  zoomLocation?: { center: [number, number]; zoom?: number; timestamp: number } | null;
}

export default function MapViewComponent({
  mode,
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
  onPolygonDrawn,
}: MapViewComponentProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const assetsLayerRef = useRef<GraphicsLayer | null>(null);
  const selectionLayerRef = useRef<GraphicsLayer | null>(null);
  const issuesLayerRef = useRef<GraphicsLayer | null>(null);
  const sketchVmRef = useRef<SketchViewModel | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Keep latest props in refs for event callbacks
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Initialize MapView once on mount
  useEffect(() => {
    if (!mapDivRef.current) return;

    // 1. Basemap using OpenStreetMap WebTileLayer (D7 - no API token required)
    const osmLayer = new WebTileLayer({
      urlTemplate:
        'https://{subDomain}.tile.openstreetmap.org/{level}/{col}/{row}.png',
      subDomains: ['a', 'b', 'c'],
      copyright: '© OpenStreetMap contributors (Demo Use Only)',
    });

    // 2. Separate Graphics Layers (D7)
    const assetsLayer = new GraphicsLayer({ title: 'Assets Layer' });
    const selectionLayer = new GraphicsLayer({ title: 'Selection Layer' });
    const issuesLayer = new GraphicsLayer({ title: 'Issues Layer' });

    assetsLayerRef.current = assetsLayer;
    selectionLayerRef.current = selectionLayer;
    issuesLayerRef.current = issuesLayer;

    // 3. Map with OSM basemap and graphic layers
    const basemap = new Basemap({
      baseLayers: [osmLayer],
      title: 'OpenStreetMap',
      id: 'osm-basemap',
    });

    const map = new Map({
      basemap,
      layers: [assetsLayer, selectionLayer, issuesLayer],
    });

    // 4. MapView centered around New Administrative Capital [lng 31.762, lat 30.021]
    const view = new MapView({
      container: mapDivRef.current,
      map,
      center: [31.762, 30.021],
      zoom: 16,
      ui: {
        components: ['zoom', 'compass'],
      },
    });
    viewRef.current = view;

    // 5. SketchViewModel for drawing polygons (D7)
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
    });
    sketchVmRef.current = sketchVM;

    sketchVM.on('create', (event: any) => {
      const geom = event.graphic?.geometry || event.geometry;
      if (event.state === 'complete' && geom) {
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

        if (onPolygonDrawn) {
          onPolygonDrawn({
            type: 'Polygon',
            coordinates: coordinates as any,
          });
        }
      }
    });

    // 6. Extent stationary watcher: Reload assets on pan/zoom (D7)
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

        const isCapped = assets.length >= 5000;
        onAssetsLoaded(assets.length, isCapped);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // Stale request aborted - expected behaviour (D7)
          return;
        }
        console.error('Failed to load assets for extent:', err);
      } finally {
        onLoadingChange(false);
      }
    });

    // 7. Click listener handling interaction modes (D7)
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
      } else if (currentMode === 'ADD_ASSET') {
        // Point placement for creating asset
        const geoPoint = webMercatorUtils.webMercatorToGeographic(
          event.mapPoint,
        ) as Point;
        const lng = parseFloat(geoPoint.longitude.toFixed(6));
        const lat = parseFloat(geoPoint.latitude.toFixed(6));
        if (onMapClickPoint) {
          onMapClickPoint([lng, lat]);
        }
      }
    });

    // Cleanup: Destroy MapView on component unmount (D7)
    return () => {
      stationaryHandle.remove();
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
    } else {
      sketchVmRef.current.cancel();
    }
  }, [mode]);

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
