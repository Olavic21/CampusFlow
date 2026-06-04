import { CircleMarker, Marker } from 'react-leaflet';
import L from 'leaflet';
import { getCongestionLevel, getMarkerRadius, getBuildingIcon } from '../utils/congestionColor';

function pulseClass(level) {
  if (level === 'modere') return 'marker-pulse-slow';
  if (level === 'charge') return 'marker-pulse-fast';
  if (level === 'sature') return 'marker-pulse-flash';
  return '';
}

export default function BuildingMarker({
  building,
  occupancy,
  onSelect,
  heatmapOnly = false,
  visible = true,
}) {
  if (!visible) return null;

  const { count = 0, taux = 0 } = occupancy[building.id] || {};
  const { color, label, level } = getCongestionLevel(taux);
  const radius = getMarkerRadius(building.capacite);
  const icon = getBuildingIcon(building);
  const pulse = pulseClass(level);

  const ariaLabel = `${building.nom} — ${Math.round(taux * 100)}% occupé (${count}/${building.capacite}) — ${label}`;

  return (
    <>
      {/* Heatmap glow */}
      <CircleMarker
        center={[building.latitude, building.longitude]}
        radius={radius * 2}
        pathOptions={{
          color: 'transparent',
          fillColor: color,
          fillOpacity: heatmapOnly ? 0.35 : 0.15,
          weight: 0,
        }}
        eventHandlers={{ click: () => onSelect?.(building) }}
      />

      {!heatmapOnly && (
        <Marker
          position={[building.latitude, building.longitude]}
          icon={L.divIcon({
            className: 'building-marker-icon',
            html: `
              <div class="building-marker ${pulse}" role="img" aria-label="${ariaLabel}"
                style="--marker-color:${color}; width:${radius * 2.5}px; height:${radius * 2.5}px;">
                <div class="building-marker-inner" style="background:${color}; width:${radius * 2}px; height:${radius * 2}px;">
                  <span class="building-marker-emoji">${icon}</span>
                </div>
              </div>
            `,
            iconSize: [radius * 2.5, radius * 2.5],
            iconAnchor: [radius * 1.25, radius * 1.25],
          })}
          eventHandlers={{ click: () => onSelect?.(building) }}
        />
      )}
    </>
  );
}
