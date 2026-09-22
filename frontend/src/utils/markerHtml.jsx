import { renderToStaticMarkup } from 'react-dom/server';
import { getBuildingLucideIcon } from './buildingVisuals';

/**
 * Marqueur carte premium (HTML pour Leaflet divIcon).
 */
export function createPremiumMarkerHtml(building, { color, level, selected, dimmed = false, size = 44 }) {
  let iconSvg = '<span style="width:18px;height:18px;background:#fff;border-radius:50%"></span>';
  try {
    if (building?.id != null) {
      const Icon = getBuildingLucideIcon(building);
      iconSvg = renderToStaticMarkup(
        <Icon size={18} color="#ffffff" strokeWidth={2.5} aria-hidden />,
      );
    }
  } catch (e) {
    console.warn('[CampusFlow] marker icon', e);
  }
  const pulse =
    level === 'modere'
      ? 'marker-pulse-slow'
      : level === 'charge'
        ? 'marker-pulse-fast'
        : level === 'sature'
          ? 'marker-pulse-flash'
          : '';
  const selectedClass = selected ? 'marker-selected' : '';
  const dimmedClass = dimmed ? 'cf-marker-dimmed' : '';

  const label = building?.code || building?.nom || '';
  const shortLabel = label.length > 8 ? `${label.slice(0, 7)}…` : label;

  return `
    <div class="cf-marker ${pulse} ${selectedClass} ${dimmedClass}" style="--cf-color:${color};--cf-size:${size}px" role="img">
      <div class="cf-marker-glow"></div>
      <div class="cf-marker-pin">
        <div class="cf-marker-icon">${iconSvg}</div>
      </div>
      <div class="cf-marker-tail"></div>
      ${shortLabel ? `<div class="cf-marker-label">${shortLabel}</div>` : ''}
    </div>
  `;
}
