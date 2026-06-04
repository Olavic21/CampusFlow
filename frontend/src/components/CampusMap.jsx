import { useCallback, useEffect, useMemo, memo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, ScaleControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';

import BuildingMarker from './BuildingMarker';
import MapLegend from './MapLegend';
import CampusHUD from './CampusHUD';
import NavigationHUD from './navigation/NavigationHUD';
import RouteLegend from './routes/RouteLegend';
import { filterBuildings } from '../utils/filterBuildings';

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

function FitPathBounds({ coordsList, active }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    const allCoords = coordsList?.filter((c) => c?.length >= 2) ?? [];
    if (!allCoords.length) return;

    const bounds = L.latLngBounds(allCoords);
    map.fitBounds(bounds, {
      padding: [100, 100],
      maxZoom: 19,
      animate: true,
      duration: 1.2,
    });
  }, [coordsList, active, map]);
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
  mapRef,
  navigationMode = false,
  onExitNavigation,
  guideStepIndex = 0,
  guideSteps = [],
  pathIdsOnMap = new Set(),
  onSelectRoute,
  onRemoveRoute,
}) {
  const filteredBuildings = useMemo(
    () => filterBuildings(buildings, filters, occupancy),
    [buildings, filters, occupancy],
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
  const selectedId = selectedBuilding?.id ?? null;

  const primaryRoute = displayRoutes[displayRoutes.length - 1];

  return (
    <div
      className={`absolute inset-0 transition-all duration-500 ${navigationMode ? 'cf-map-nav-mode' : ''}`}
      ref={mapRef}
    >
      <MapContainer
        center={CENTER}
        zoom={ZOOM}
        maxBounds={BOUNDS}
        maxBoundsViscosity={1}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer attribution='&copy; OpenStreetMap' url={darkMode ? DARK : OSM} maxZoom={19} />
        <MapResizer />
        <CustomZoomControl hidden={navigationMode} />
        {!navigationMode && <ScaleControl imperial={false} position="bottomleft" />}
        <MapFlyController flyToBuilding={flyToBuilding} flyToCoords={flyToCoords} />
        <FitPathBounds coords={fitCoords} active={!!fitCoords.length && displayRoutes.length > 0} />

        {filteredBuildings.map((b) => (
          <BuildingMarker
            key={b.id}
            building={b}
            occupancy={occupancy}
            onSelect={handleSelect}
            heatmapOnly={filters.heatmapOnly}
            visible
            selected={selectedId === b.id}
            onRoute={pathIds.has(b.id)}
            dimmed={navigationMode && !pathIds.has(b.id)}
            navigationMode={navigationMode}
          />
        ))}

        {displayRoutes.map((route) => {
          if (!route.result?.coords?.length) return null;
          const color = route.color;
          return (
            <span key={route.id}>
              <Polyline
                positions={route.result.coords}
                pathOptions={{
                  color,
                  weight: 14,
                  opacity: 0.3,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              <Polyline
                positions={route.result.coords}
                pathOptions={{
                  color,
                  weight: 8,
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
              const start = buildings.find((b) => b.id === primaryRoute.result.path[0]);
              const end = buildings.find(
                (b) => b.id === primaryRoute.result.path[primaryRoute.result.path.length - 1],
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

      {navigationMode && activeRoute?.result && (
        <NavigationHUD
          result={activeRoute.result}
          currentStepLabel={currentStepLabel}
          onExit={onExitNavigation}
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
