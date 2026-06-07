import { useCallback, useEffect, useMemo, useState, useRef, memo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, ScaleControl, useMap } from 'react-leaflet';
import { Crosshair, LocateFixed, Maximize2, Navigation2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';

import BuildingMarker from './BuildingMarker';
import MapLegend from './MapLegend';
import CampusHUD from './CampusHUD';
import NavigationHUD from './navigation/NavigationHUD';
import RouteLegend from './routes/RouteLegend';
import CampusLayoutEngine from '../engine/CampusLayoutEngine';
import { filterBuildings } from '../utils/filterBuildings';
import { isSameBuilding } from '../utils/buildingSafety';
import { slicePathToStep } from '../utils/pathProgress';

const CENTER = [3.8691, 11.5083];
const ZOOM = 18;
const BOUNDS = L.latLngBounds([3.868359, 11.507055], [3.870386, 11.509945]);

const OSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

const startIcon = L.divIcon({
  className: 'cf-route-pin',
  html: '<div class="cf-route-pin-inner cf-route-start cf-route-pulse"></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const endIcon = L.divIcon({
  className: 'cf-route-pin',
  html: '<div class="cf-route-pin-inner cf-route-end cf-route-pulse"></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize({ animate: false });
    fix();
    const t = setTimeout(fix, 200);
    window.addEventListener('resize', fix);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', fix);
    };
  }, [map]);
  return null;
}

function MapUserPanTracker({ enabled, onUserPan }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return undefined;
    const handlePan = () => onUserPan?.();
    map.on('dragstart', handlePan);
    return () => {
      map.off('dragstart', handlePan);
    };
  }, [map, enabled, onUserPan]);
  return null;
}

function CustomZoomControl({ hidden }) {
  const map = useMap();
  useEffect(() => {
    if (hidden) return undefined;
    const control = L.control({ position: 'topright' });
    control.onAdd = () => {
      const div = L.DomUtil.create('div', 'custom-zoom-control cf-glass');
      div.innerHTML = `
        <button type="button" data-action="in" aria-label="Zoom avant">+</button>
        <button type="button" data-action="out" aria-label="Zoom arrière">−</button>
      `;
      L.DomEvent.disableClickPropagation(div);
      div.querySelector('[data-action="in"]').onclick = () => map.zoomIn();
      div.querySelector('[data-action="out"]').onclick = () => map.zoomOut();
      return div;
    };
    control.addTo(map);
    return () => control.remove();
  }, [map, hidden]);
  return null;
}

function MapFlyController({ flyToBuilding, flyToCoords }) {
  const map = useMap();
  useEffect(() => {
    if (flyToBuilding?.latitude != null) {
      map.flyTo([flyToBuilding.latitude, flyToBuilding.longitude], 19, { duration: 0.8 });
    }
  }, [flyToBuilding, map]);
  useEffect(() => {
    if (flyToCoords?.length === 2) {
      map.flyTo(flyToCoords, 19, { duration: 0.6 });
    }
  }, [flyToCoords, map]);
  return null;
}

const userLocationIcon = L.divIcon({
  className: 'cf-user-location',
  html: '<div class="cf-user-location-dot"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function MapApiBridge({ mapRef }) {
  const map = useMap();
  useEffect(() => {
    if (mapRef) mapRef.current = map;
    return () => {
      if (mapRef) mapRef.current = null;
    };
  }, [map, mapRef]);
  return null;
}

function FitPathBounds({ coordsList, active, navigationMode, routeKey }) {
  const map = useMap();
  const lastKey = useRef(null);

  useEffect(() => {
    if (!active || !coordsList?.length) return;
    if (navigationMode && lastKey.current === routeKey) return;
    lastKey.current = routeKey;

    const allCoords = coordsList.filter((c) => c?.length >= 2);
    if (!allCoords.length) return;

    const bounds = L.latLngBounds(allCoords);
    map.fitBounds(bounds, {
      padding: navigationMode ? [140, 80] : [100, 100],
      maxZoom: navigationMode ? 19 : 18,
      animate: true,
      duration: navigationMode ? 0.9 : 1.2,
    });
  }, [coordsList, active, navigationMode, routeKey, map]);
  return null;
}

/** Suit l'étape active + cadre le tronçon parcouru */
function NavigationStepFollower({
  guideSteps,
  guideStepIndex,
  navigationMode,
  routeResult,
  pathNodes,
  followEnabled,
  focusToken,
}) {
  const map = useMap();
  const prevIndex = useRef(-1);
  const prevToken = useRef(-1);

  useEffect(() => {
    if (!navigationMode || !guideSteps?.length || !routeResult || !followEnabled) return;
    const stepChanged = guideStepIndex !== prevIndex.current;
    const focusRequested = focusToken !== prevToken.current;
    if (!stepChanged && !focusRequested) return;
    prevIndex.current = guideStepIndex;
    prevToken.current = focusToken;

    const step = guideSteps[guideStepIndex];
    const b = step?.building;
    if (b?.latitude == null) return;

    const target = [b.latitude, b.longitude];
    const { coords: partial } = slicePathToStep(routeResult, b, pathNodes);
    const segment = partial.length > 1 ? partial : routeResult.coords ?? [];
    if (segment.length > 2) {
      const bounds = L.latLngBounds([...segment, target]);
      map.flyToBounds(bounds, { padding: [120, 80], maxZoom: 19, duration: 0.8 });
    } else {
      map.flyTo(target, 19, { duration: 0.7 });
    }
  }, [navigationMode, guideSteps, guideStepIndex, routeResult, pathNodes, map, followEnabled, focusToken]);

  return null;
}

function CampusMap({
  buildings,
  occupancy,
  globalStats,
  offline,
  formattedTime,
  filters,
  routes = [],
  activeRouteId,
  routeMode = 'single',
  darkMode,
  flyToBuilding,
  flyToCoords,
  selectedBuilding,
  onBuildingSelect,
  mapRef: mapContainerRef,
  navigationMode = false,
  onExitNavigation,
  guideStepIndex = 0,
  guideSteps = [],
  pathIdsOnMap = new Set(),
  pathNodes = {},
  onSelectRoute,
  onRemoveRoute,
  onStepPrev,
  onStepNext,
  stepFocusToken = 0,
}) {
  const gpsBuildings = useMemo(
    () => CampusLayoutEngine.getGpsBuildings(occupancy, buildings),
    [buildings, occupancy],
  );

  const filteredBuildings = useMemo(
    () => filterBuildings(gpsBuildings, filters, occupancy),
    [gpsBuildings, filters, occupancy],
  );

  const handleSelect = useCallback(
    (building) => {
      try {
        onBuildingSelect?.(building);
      } catch (e) {
        console.error('[CampusFlow] building select', e);
      }
    },
    [onBuildingSelect],
  );

  const displayRoutes = useMemo(() => {
    if (navigationMode && activeRouteId) {
      return routes.filter((r) => r.id === activeRouteId);
    }
    if (routeMode === 'compare') return routes;
    const last = routes[routes.length - 1];
    return last ? [last] : [];
  }, [routes, navigationMode, activeRouteId, routeMode]);

  const pathIds = useMemo(() => {
    if (pathIdsOnMap?.size) return pathIdsOnMap;
    const ids = new Set();
    displayRoutes.forEach((r) => r.result?.path?.forEach((id) => ids.add(id)));
    return ids;
  }, [pathIdsOnMap, displayRoutes]);

  const fitCoords = useMemo(() => {
    const flat = [];
    displayRoutes.forEach((r) => {
      r.result?.coords?.forEach((c) => flat.push(c));
    });
    return flat;
  }, [displayRoutes]);

  const activeRoute = routes.find((r) => r.id === activeRouteId) ?? displayRoutes[0];
  const currentStepLabel = guideSteps[guideStepIndex]?.label;
  const findRouteBuilding = useCallback(
    (routePointId) =>
      gpsBuildings.find((b) => b.geoId === routePointId || b.id === routePointId) ??
      buildings.find((b) => b.id === routePointId),
    [gpsBuildings, buildings],
  );

  const primaryRoute = displayRoutes[displayRoutes.length - 1];

  const navPartialCoords = useMemo(() => {
    if (!navigationMode || !primaryRoute?.result?.coords) return [];
    const stepBuilding = guideSteps[guideStepIndex]?.building;
    if (!stepBuilding) return primaryRoute.result.coords;
    const { coords } = slicePathToStep(primaryRoute.result, stepBuilding, pathNodes);
    return coords.length > 1 ? coords : primaryRoute.result.coords;
  }, [navigationMode, primaryRoute, guideSteps, guideStepIndex, pathNodes]);

  const mapBounds = useMemo(() => {
    const pts = gpsBuildings
      .filter((b) => b.latitude != null && b.longitude != null)
      .map((b) => [b.latitude, b.longitude]);
    if (!pts.length) return BOUNDS;
    const bounds = L.latLngBounds(pts);
    return bounds.pad(0.1);
  }, [gpsBuildings]);

  const campusCenter = useMemo(() => {
    const c = mapBounds.getCenter();
    return [c.lat, c.lng];
  }, [mapBounds]);

  const [userPosition, setUserPosition] = useState(null);
  const [mapFollowEnabled, setMapFollowEnabled] = useState(true);
  const leafletMapRef = useRef(null);

  useEffect(() => {
    if (!navigationMode) {
      setMapFollowEnabled(true);
    }
  }, [navigationMode]);

  useEffect(() => {
    if (navigationMode && stepFocusToken > 0) {
      setMapFollowEnabled(true);
    }
  }, [stepFocusToken, navigationMode]);

  const handleUserPan = useCallback(() => {
    if (navigationMode) setMapFollowEnabled(false);
  }, [navigationMode]);

  const handleFollowStep = useCallback(() => {
    setMapFollowEnabled(true);
    const step = guideSteps[guideStepIndex]?.building;
    if (!step?.latitude || !primaryRoute?.result) return;
    const { coords: partial } = slicePathToStep(primaryRoute.result, step, pathNodes);
    const segment = partial.length > 1 ? partial : primaryRoute.result.coords ?? [];
    const target = [step.latitude, step.longitude];
    if (segment.length > 2) {
      const bounds = L.latLngBounds([...segment, target]);
      leafletMapRef.current?.flyToBounds(bounds, { padding: [100, 60], maxZoom: 19, animate: true });
    } else {
      leafletMapRef.current?.flyTo(target, 19, { duration: 0.7 });
    }
  }, [guideSteps, guideStepIndex, primaryRoute, pathNodes]);

  const handleFitRoute = useCallback(() => {
    if (fitCoords.length > 1) {
      const bounds = L.latLngBounds(fitCoords);
      leafletMapRef.current?.fitBounds(bounds, { padding: [120, 80], maxZoom: 19, animate: true });
    }
  }, [fitCoords]);

  const handleRecenter = useCallback(() => {
    leafletMapRef.current?.flyTo(campusCenter, 18, { duration: 0.7 });
  }, [campusCenter]);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setUserPosition(coords);
        leafletMapRef.current?.flyTo(coords, 19, { duration: 0.8 });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const hasActiveRoute = displayRoutes.some((r) => r.result?.coords?.length > 1);

  return (
    <div
      className={`absolute inset-0 transition-all duration-500 ${navigationMode ? 'cf-map-nav-mode' : ''}`}
      ref={mapContainerRef}
    >
      <MapContainer
        center={CENTER}
        zoom={ZOOM}
        minZoom={16}
        maxZoom={20}
        maxBounds={mapBounds}
        maxBoundsViscosity={navigationMode ? 0.12 : 0.85}
        zoomControl={false}
        scrollWheelZoom
        touchZoom
        doubleClickZoom
        zoomSnap={0.5}
        zoomDelta={0.5}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer attribution='&copy; OpenStreetMap' url={darkMode ? DARK : OSM} maxZoom={19} />
        <MapResizer />
        <MapApiBridge mapRef={leafletMapRef} />
        <CustomZoomControl hidden={false} />
        <ScaleControl imperial={false} position="bottomleft" />
        <MapUserPanTracker enabled={navigationMode} onUserPan={handleUserPan} />
        <MapFlyController flyToBuilding={flyToBuilding} flyToCoords={flyToCoords} />
        <FitPathBounds
          coordsList={fitCoords}
          active={hasActiveRoute}
          navigationMode={navigationMode}
          routeKey={primaryRoute?.id}
        />
        <NavigationStepFollower
          guideSteps={guideSteps}
          guideStepIndex={guideStepIndex}
          navigationMode={navigationMode}
          routeResult={primaryRoute?.result}
          pathNodes={pathNodes}
          followEnabled={mapFollowEnabled}
          focusToken={stepFocusToken}
        />

        {userPosition && (
          <Marker position={userPosition} icon={userLocationIcon} zIndexOffset={1500} />
        )}

        {filteredBuildings.map((b) => (
          <BuildingMarker
            key={b.id}
            building={b}
            occupancy={occupancy}
            onSelect={handleSelect}
            heatmapOnly={filters.heatmapOnly}
            visible
            selected={isSameBuilding(selectedBuilding, b)}
            onRoute={pathIds.has(b.geoId) || pathIds.has(b.id)}
            dimmed={navigationMode && !(pathIds.has(b.geoId) || pathIds.has(b.id))}
            navigationMode={navigationMode}
          />
        ))}

        {displayRoutes.map((route) => {
          if (!route.result?.coords?.length) return null;
          const color = route.color;
          const isActiveNav = navigationMode && route.id === activeRoute?.id;
          const mainCoords = isActiveNav && navPartialCoords.length > 1 ? navPartialCoords : route.result.coords;
          return (
            <span key={route.id}>
              {isActiveNav && (
                <Polyline
                  positions={route.result.coords}
                  pathOptions={{
                    color,
                    weight: 14,
                    opacity: mapFollowEnabled ? 0.22 : 0.38,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              )}
              <Polyline
                positions={mainCoords}
                pathOptions={{
                  color,
                  weight: navigationMode ? 16 : 14,
                  opacity: 0.3,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              <Polyline
                positions={mainCoords}
                pathOptions={{
                  color,
                  weight: navigationMode ? 9 : 8,
                  opacity: 1,
                  lineCap: 'round',
                  lineJoin: 'round',
                  className: navigationMode ? 'path-nav-premium' : 'path-animated',
                }}
              />
            </span>
          );
        })}

        {primaryRoute?.result?.path?.length > 0 && (
          <>
            {(() => {
              const start = findRouteBuilding(primaryRoute.result.path[0]);
              const end = findRouteBuilding(
                primaryRoute.result.path[primaryRoute.result.path.length - 1],
              );
              return (
                <>
                  {start && (
                    <Marker
                      position={[start.latitude, start.longitude]}
                      icon={startIcon}
                      zIndexOffset={2000}
                    />
                  )}
                  {end && (
                    <Marker
                      position={[end.latitude, end.longitude]}
                      icon={endIcon}
                      zIndexOffset={2000}
                    />
                  )}
                </>
              );
            })()}
          </>
        )}
      </MapContainer>

      <div
        className={`absolute right-3 z-[25] flex flex-col gap-2 ${
          navigationMode ? 'bottom-36 md:bottom-28' : 'bottom-28 md:bottom-20'
        }`}
      >
        {hasActiveRoute && (
          <button
            type="button"
            className="cf-glass w-10 h-10 rounded-xl shadow-lg flex items-center justify-center"
            onClick={handleFitRoute}
            aria-label="Voir tout l'itinéraire"
            title="Voir l'itinéraire"
          >
            <Maximize2 size={16} className="text-[#2563EB]" />
          </button>
        )}
        <button
          type="button"
          className="cf-glass w-10 h-10 rounded-xl shadow-lg flex items-center justify-center"
          onClick={handleRecenter}
          aria-label="Recentrer sur le campus"
          title="Recentrer"
        >
          <Crosshair size={18} className="text-[#2563EB]" />
        </button>
        {navigationMode ? (
          <button
            type="button"
            className={`cf-glass w-10 h-10 rounded-xl shadow-lg flex items-center justify-center ${
              !mapFollowEnabled ? 'ring-2 ring-[#2563EB]/50' : ''
            }`}
            onClick={handleFollowStep}
            aria-label="Suivre l'étape ou voir l'itinéraire complet"
            title={mapFollowEnabled ? 'Recentrer sur l\'étape' : 'Suivre l\'étape (déplacement libre actif)'}
          >
            <Navigation2 size={18} className="text-[#2563EB]" />
          </button>
        ) : (
          <button
            type="button"
            className="cf-glass w-10 h-10 rounded-xl shadow-lg flex items-center justify-center"
            onClick={handleLocate}
            aria-label="Ma position"
            title="Ma position"
          >
            <LocateFixed size={18} className="text-[#2563EB]" />
          </button>
        )}
      </div>

      {navigationMode && activeRoute?.result && (
        <NavigationHUD
          result={activeRoute.result}
          currentStepLabel={currentStepLabel}
          stepIndex={guideStepIndex}
          stepCount={guideSteps.length}
          onExit={onExitNavigation}
          onStepPrev={onStepPrev}
          onStepNext={onStepNext}
        />
      )}

      <RouteLegend
        routes={routes}
        activeRouteId={activeRouteId}
        onSelectRoute={onSelectRoute}
        onRemoveRoute={onRemoveRoute}
        visible={routeMode === 'compare' && routes.length > 0 && !navigationMode}
      />

      <MapLegend visible={!navigationMode && routeMode !== 'compare'} />
      {!navigationMode && (
        <CampusHUD
          globalStats={globalStats}
          formattedTime={formattedTime}
          offline={offline}
        />
      )}
    </div>
  );
}

export default memo(CampusMap);
