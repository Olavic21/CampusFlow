import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, ScaleControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';

import BuildingMarker from './BuildingMarker';
import BuildingPopup from './BuildingPopup';
import MapLegend from './MapLegend';
import CampusHUD from './CampusHUD';
import { getCongestionLevel } from '../utils/congestionColor';

const CENTER = [3.8691, 11.5083];
const ZOOM = 18;
const BOUNDS = L.latLngBounds([3.868359, 11.507055], [3.870386, 11.509945]);

const OSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize({ animate: false });
    fix();
    const t = setTimeout(fix, 200);
    window.addEventListener('resize', fix);
    return () => { clearTimeout(t); window.removeEventListener('resize', fix); };
  }, [map]);
  return null;
}

function CustomZoomControl() {
  const map = useMap();
  useEffect(() => {
    const control = L.control({ position: 'topright' });
    control.onAdd = () => {
      const div = L.DomUtil.create('div', 'custom-zoom-control');
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
  }, [map]);
  return null;
}

function MapController({ flyToBuilding, selectedBuilding }) {
  const map = useMap();
  useEffect(() => {
    if (flyToBuilding) {
      map.flyTo([flyToBuilding.latitude, flyToBuilding.longitude], 19, { duration: 0.8 });
    }
  }, [flyToBuilding, map]);
  return null;
}

function PopupLayer({ building, occupancy, currentHour, onNavigate, onHistory, onClose }) {
  const map = useMap();
  const popupRef = useRef(null);

  useEffect(() => {
    if (!building) return;
    const popup = L.popup({
      closeButton: true,
      minWidth: 280,
      className: 'building-custom-popup',
      offset: [0, -10],
    })
      .setLatLng([building.latitude, building.longitude])
      .setContent('<div id="building-popup-root"></div>')
      .openOn(map);

    popupRef.current = popup;

    import('react-dom/client').then(({ createRoot }) => {
      const el = document.getElementById('building-popup-root');
      if (!el) return;
      const root = createRoot(el);
      root.render(
        <BuildingPopup
          building={building}
          occupancy={occupancy}
          currentHour={currentHour}
          onNavigate={(b) => { onNavigate(b); popup.close(); }}
          onHistory={(b) => { onHistory(b); popup.close(); }}
        />
      );
      popup.on('remove', () => root.unmount());
    });

    return () => { map.closePopup(popup); };
  }, [building, map, occupancy, currentHour, onNavigate, onHistory]);

  return null;
}

export default function CampusMap({
  buildings,
  occupancy,
  globalStats,
  offline,
  formattedTime,
  filters,
  pathResult,
  darkMode,
  flyToBuilding,
  selectedBuilding,
  onBuildingSelect,
  onNavigate,
  onHistory,
  mapRef,
}) {
  const [popupBuilding, setPopupBuilding] = useState(null);

  const filteredBuildings = useMemo(() => {
    return buildings.filter((b) => {
      if (!filters.types.includes(b.type)) return false;
      const taux = occupancy[b.id]?.taux ?? 0;
      const { level } = getCongestionLevel(taux);
      if (filters.congestion === 'disponible' && level !== 'disponible') return false;
      if (filters.congestion === 'charge' && level !== 'charge') return false;
      if (filters.congestion === 'sature' && level !== 'sature') return false;
      return true;
    });
  }, [buildings, filters, occupancy]);

  const handleSelect = useCallback((building) => {
    setPopupBuilding(building);
    onBuildingSelect?.(building);
  }, [onBuildingSelect]);

  useEffect(() => {
    if (selectedBuilding) setPopupBuilding(selectedBuilding);
  }, [selectedBuilding]);

  const pathColor = pathResult?.hasSaturated ? '#f59e0b' : '#22c55e';

  const startEndMarkers = useMemo(() => {
    if (!pathResult?.path?.length) return null;
    const start = buildings.find((b) => b.id === pathResult.path[0]);
    const end = buildings.find((b) => b.id === pathResult.path[pathResult.path.length - 1]);
    return { start, end };
  }, [pathResult, buildings]);

  return (
    <div className="absolute inset-0" ref={mapRef}>
      <MapContainer
        center={CENTER}
        zoom={ZOOM}
        maxBounds={BOUNDS}
        maxBoundsViscosity={1}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url={darkMode ? DARK : OSM}
          maxZoom={19}
        />
        <MapResizer />
        <CustomZoomControl />
        <ScaleControl imperial={false} position="bottomleft" />
        <MapController flyToBuilding={flyToBuilding} selectedBuilding={selectedBuilding} />

        {filteredBuildings.map((b) => (
          <BuildingMarker
            key={b.id}
            building={b}
            occupancy={occupancy}
            onSelect={handleSelect}
            heatmapOnly={filters.heatmapOnly}
            visible
          />
        ))}

        {pathResult?.coords && (
          <Polyline
            positions={pathResult.coords}
            pathOptions={{
              color: pathColor,
              weight: 5,
              opacity: 0.85,
              dashArray: '12 8',
              className: 'path-animated',
            }}
          />
        )}

        {startEndMarkers?.start && (
          <Marker
            position={[startEndMarkers.start.latitude, startEndMarkers.start.longitude]}
            icon={L.divIcon({
              className: '',
              html: '<div style="font-size:24px">🟢</div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            })}
          />
        )}
        {startEndMarkers?.end && (
          <Marker
            position={[startEndMarkers.end.latitude, startEndMarkers.end.longitude]}
            icon={L.divIcon({
              className: '',
              html: '<div style="font-size:24px">🔴</div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            })}
          />
        )}

        {popupBuilding && (
          <PopupLayer
            building={popupBuilding}
            occupancy={occupancy}
            currentHour={parseInt(formattedTime.split('h')[0], 10)}
            onNavigate={onNavigate}
            onHistory={onHistory}
            onClose={() => setPopupBuilding(null)}
          />
        )}
      </MapContainer>

      <MapLegend />
      <CampusHUD
        globalStats={globalStats}
        formattedTime={formattedTime}
        offline={offline}
      />
    </div>
  );
}
