import { memo, useMemo } from 'react';
import { CircleMarker, Marker } from 'react-leaflet';
import L from 'leaflet';
import { getCongestionLevel, getMarkerRadius } from '../utils/congestionColor';
import { createPremiumMarkerHtml } from '../utils/markerHtml.jsx';

function BuildingMarker({
  building,
  occupancy,
  onSelect,
  heatmapOnly = false,
  visible = true,
  selected = false,
  onRoute = false,
  dimmed = false,
  navigationMode = false,
}) {
  if (!visible) return null;

  const occ = occupancy[building.id] || {};
  const count = occ.count ?? 0;
  const taux = occ.taux ?? 0;
  const levelInfo = occ.color
    ? { color: occ.color, label: occ.label, level: occ.level }
    : getCongestionLevel(taux);
  const { color, label, level } = levelInfo;
  const radius = getMarkerRadius(building.capacite);
  const size = onRoute || selected ? Math.max(48, radius * 3.5) : Math.max(40, radius * 3.2);
  const isDimmed = navigationMode && dimmed && !onRoute && !selected;

  const ariaLabel = `${building.nom} — ${Math.round(taux * 100)}% occupé (${count}/${building.capacite}) — ${label}`;

  const markerIcon = useMemo(
    () =>
      L.divIcon({
        className: 'building-marker-icon',
        html: createPremiumMarkerHtml(building, {
          color,
          level: isDimmed ? null : level,
          selected: selected || onRoute,
          dimmed: isDimmed,
          size,
        }),
        iconSize: [size, size + 8],
        iconAnchor: [size / 2, size + 6],
      }),
    [building, color, level, selected, onRoute, isDimmed, size],
  );

  const handleClick = useMemo(
    () => ({ click: () => onSelect?.(building) }),
    [building, onSelect],
  );

  const heatOpacity = isDimmed ? 0.06 : heatmapOnly ? 0.35 : 0.12;

  return (
    <>
      <CircleMarker
        center={[building.latitude, building.longitude]}
        radius={radius * 2}
        pathOptions={{
          color: 'transparent',
          fillColor: color,
          fillOpacity: heatOpacity,
          weight: 0,
        }}
        eventHandlers={handleClick}
      />

      {!heatmapOnly && (
        <Marker
          position={[building.latitude, building.longitude]}
          icon={markerIcon}
          eventHandlers={handleClick}
          alt={ariaLabel}
          zIndexOffset={onRoute || selected ? 1000 : isDimmed ? 0 : 100}
        />
      )}
    </>
  );
}

function propsAreEqual(prev, next) {
  if (prev.building.id !== next.building.id) return false;
  if (
    prev.heatmapOnly !== next.heatmapOnly ||
    prev.visible !== next.visible ||
    prev.selected !== next.selected ||
    prev.onRoute !== next.onRoute ||
    prev.dimmed !== next.dimmed ||
    prev.navigationMode !== next.navigationMode
  ) {
    return false;
  }
  const p = prev.occupancy[prev.building.id];
  const n = next.occupancy[next.building.id];
  return (
    p?.count === n?.count &&
    p?.taux === n?.taux &&
    p?.color === n?.color &&
    p?.level === n?.level
  );
}

export default memo(BuildingMarker, propsAreEqual);
