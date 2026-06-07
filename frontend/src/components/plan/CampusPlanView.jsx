import { memo, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, Maximize2 } from 'lucide-react';
import CampusLayoutEngine from '../../engine/CampusLayoutEngine';
import { slicePathToStep } from '../../utils/pathProgress';
import MapLegend from '../MapLegend';
import NavigationHUD from '../navigation/NavigationHUD';
import RouteLegend from '../routes/RouteLegend';

const VB = CampusLayoutEngine.getViewBox();
const DRAG_THRESHOLD = 6;

function polygonPoints(poly) {
  return poly.map((p) => p.join(',')).join(' ');
}

function planBounds(coords) {
  if (!coords?.length) return null;
  const xs = coords.map((p) => p[0]);
  const ys = coords.map((p) => p[1]);
  const pad = 100;
  return {
    x: Math.min(...xs) - pad,
    y: Math.min(...ys) - pad,
    w: Math.max(...xs) - Math.min(...xs) + pad * 2,
    h: Math.max(...ys) - Math.min(...ys) + pad * 2,
  };
}

function CampusPlanView({
  buildings: geoBuildings = [],
  occupancy = {},
  selectedBuilding,
  onBuildingSelect,
  routes = [],
  activeRouteId,
  routeMode = 'single',
  navigationMode = false,
  pathIdsOnMap = [],
  darkMode = false,
  flyToBuilding = null,
  guideStepIndex = 0,
  guideSteps = [],
  pathNodes = {},
  onExitNavigation,
  onSelectRoute,
  onRemoveRoute,
  onStepPrev,
  onStepNext,
}) {
  const svgRef = useRef(null);
  const [viewBox, setViewBox] = useState({
    x: 0,
    y: 0,
    w: VB.width,
    h: VB.height,
  });
  const pointerRef = useRef(null);
  const didDragRef = useRef(false);
  const lastFitRouteRef = useRef(null);

  const enriched = useMemo(
    () => CampusLayoutEngine.enrichAll(occupancy, geoBuildings),
    [occupancy, geoBuildings],
  );

  const displayRoutes = useMemo(() => {
    if (navigationMode && activeRouteId) {
      return routes.filter((r) => r.id === activeRouteId);
    }
    if (routeMode === 'compare') return routes;
    const last = routes[routes.length - 1];
    return last ? [last] : [];
  }, [routes, navigationMode, activeRouteId, routeMode]);

  const pathSet = useMemo(() => {
    const s = pathIdsOnMap instanceof Set ? pathIdsOnMap : new Set(pathIdsOnMap || []);
    return s;
  }, [pathIdsOnMap]);

  const activeRoute = routes.find((r) => r.id === activeRouteId) ?? displayRoutes[0];
  const currentStepLabel = guideSteps[guideStepIndex]?.label;

  const fitToPlanCoords = useCallback((coords) => {
    const b = planBounds(coords);
    if (!b) return;
    setViewBox(b);
  }, []);

  useEffect(() => {
    const route = displayRoutes[displayRoutes.length - 1];
    const coords = route?.result?.planCoords;
    if (!coords?.length || coords.length < 2) return;
    if (lastFitRouteRef.current === route.id && !navigationMode) return;
    lastFitRouteRef.current = route.id;
    fitToPlanCoords(coords);
  }, [displayRoutes, navigationMode, fitToPlanCoords]);

  useEffect(() => {
    if (!flyToBuilding) return;
    const twin = CampusLayoutEngine.resolve(flyToBuilding, occupancy, geoBuildings);
    const cx = twin?.center?.[0];
    const cy = twin?.center?.[1];
    if (cx == null || cy == null) return;
    const span = Math.min(viewBox.w, viewBox.h) * 0.35;
    setViewBox({
      x: cx - span / 2,
      y: cy - span / 2,
      w: span,
      h: span,
    });
  }, [flyToBuilding, occupancy, geoBuildings]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBuildingClick = useCallback(
    (building, e) => {
      e?.stopPropagation?.();
      if (didDragRef.current) return;
      const full = CampusLayoutEngine.enrichBuilding(building, occupancy, geoBuildings);
      onBuildingSelect?.(full);
    },
    [occupancy, geoBuildings, onBuildingSelect],
  );

  const onPanPointerDown = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    didDragRef.current = false;
    pointerRef.current = {
      x: e.clientX,
      y: e.clientY,
      viewBox: { ...viewBox },
      rect: svgRef.current?.getBoundingClientRect(),
    };
  };

  const onPanPointerMove = (e) => {
    if (!pointerRef.current?.rect) return;
    const dx = e.clientX - pointerRef.current.x;
    const dy = e.clientY - pointerRef.current.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) didDragRef.current = true;
    if (!didDragRef.current) return;

    const { viewBox: vb0, rect } = pointerRef.current;
    const scaleX = vb0.w / rect.width;
    const scaleY = vb0.h / rect.height;
    setViewBox({
      ...vb0,
      x: vb0.x - dx * scaleX,
      y: vb0.y - dy * scaleY,
    });
  };

  const onPanPointerUp = (e) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    pointerRef.current = null;
  };

  const zoomBy = (factor) => {
    setViewBox((vb) => {
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      const nw = Math.min(VB.width * 2, Math.max(120, vb.w * factor));
      const nh = Math.min(VB.height * 2, Math.max(120, vb.h * factor));
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    });
  };

  const bg = darkMode ? '#0a0f1a' : '#e8f5e9';
  const roadColor = darkMode ? '#475569' : '#d97706';
  const buildingStroke = darkMode ? '#1e293b' : '#ffffff';

  const isOnPath = useCallback(
    (b) => pathSet.has(b.geoId) || pathSet.has(b.id),
    [pathSet],
  );

  const activeStepBuildingId = guideSteps[guideStepIndex]?.buildingId;

  const navProgressPath = useMemo(() => {
    if (!navigationMode || !activeRoute?.result?.planCoords) return null;
    const stepBuilding = guideSteps[guideStepIndex]?.building;
    if (!stepBuilding) return activeRoute.result.planCoords;
    const { planCoords } = slicePathToStep(activeRoute.result, stepBuilding, pathNodes);
    return planCoords.length > 1 ? planCoords : activeRoute.result.planCoords;
  }, [navigationMode, activeRoute, guideSteps, guideStepIndex, pathNodes]);

  const prevNavStepRef = useRef(-1);
  useEffect(() => {
    if (!navigationMode || guideStepIndex === prevNavStepRef.current) return;
    prevNavStepRef.current = guideStepIndex;
    const stepBuilding = guideSteps[guideStepIndex]?.building;
    if (!stepBuilding || !activeRoute?.result) return;
    const { planCoords } = slicePathToStep(activeRoute.result, stepBuilding, pathNodes);
    const focusCoords = planCoords.length > 1 ? planCoords : activeRoute.result.planCoords;
    const b = planBounds(focusCoords);
    if (b) setViewBox(b);
  }, [navigationMode, guideStepIndex, guideSteps, activeRoute, pathNodes]);

  return (
    <div className="absolute inset-0 z-[10] overflow-hidden bg-slate-950 select-none">
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="w-full h-full touch-none"
        role="img"
        aria-label="Plan interactif du campus SUP'PTIC"
      >
        <rect
          x={viewBox.x - 50}
          y={viewBox.y - 50}
          width={viewBox.w + 100}
          height={viewBox.h + 100}
          fill={bg}
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={onPanPointerDown}
          onPointerMove={onPanPointerMove}
          onPointerUp={onPanPointerUp}
          onPointerLeave={onPanPointerUp}
          onPointerCancel={onPanPointerUp}
        />

        <image
          href="/assets/campus-plan.png"
          x="0"
          y="0"
          width={VB.width}
          height={VB.height}
          opacity={darkMode ? 0.55 : 0.72}
          preserveAspectRatio="xMidYMid meet"
          pointerEvents="none"
        />

        {CampusLayoutEngine.getZones().map((z) => (
          <polygon
            key={z.id}
            points={polygonPoints(z.polygon)}
            fill={z.color || (darkMode ? '#14532d33' : '#22c55e22')}
            stroke="none"
            pointerEvents="none"
          />
        ))}

        {CampusLayoutEngine.getRoads().map((rd) => (
          <polyline
            key={rd.id}
            points={rd.points.map((p) => p.join(',')).join(' ')}
            fill="none"
            stroke={roadColor}
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={darkMode ? 0.7 : 0.85}
            pointerEvents="none"
          />
        ))}

        {displayRoutes.map((route) => {
          const planPath = route.result?.planCoords;
          if (!planPath?.length || planPath.length < 2) return null;
          const color = route.color || '#2563EB';
          const isActive = route.id === activeRoute?.id;
          const drawPath = isActive && navProgressPath ? navProgressPath : planPath;
          const points = drawPath.map((p) => p.join(',')).join(' ');
          const fullPoints = planPath.map((p) => p.join(',')).join(' ');
          return (
            <g key={route.id} pointerEvents="none">
              {navigationMode && isActive && (
                <polyline
                  points={fullPoints}
                  fill="none"
                  stroke={color}
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.15"
                />
              )}
              <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="18"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.35"
              />
              <motion.polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={navigationMode && isActive ? 10 : 8}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={navigationMode && isActive ? '0' : '16 10'}
                animate={navigationMode && isActive ? undefined : { strokeDashoffset: [0, -52] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              />
              <circle cx={planPath[0][0]} cy={planPath[0][1]} r="10" fill="#22C55E" stroke="#fff" strokeWidth="2" />
              <circle
                cx={planPath[planPath.length - 1][0]}
                cy={planPath[planPath.length - 1][1]}
                r="10"
                fill="#EF4444"
                stroke="#fff"
                strokeWidth="2"
              />
            </g>
          );
        })}

        {enriched.map((b) => {
          const isSelected =
            selectedBuilding?.id === b.id ||
            selectedBuilding?.twinId === b.id ||
            selectedBuilding?.geoId === b.geoId;
          const onPath = isOnPath(b);
          const isStepTarget =
            navigationMode &&
            (activeStepBuildingId === b.id ||
              activeStepBuildingId === b.geoId ||
              guideSteps[guideStepIndex]?.building?.id === b.id);
          const dimmed = navigationMode && !onPath && !isSelected && !isStepTarget && pathSet.size > 0;
          return (
            <g
              key={b.id}
              data-building={b.id}
              opacity={dimmed ? 0.3 : 1}
              style={{ transition: 'opacity 0.3s' }}
            >
              <polygon
                points={polygonPoints(b.polygon)}
                fill={b.color}
                fillOpacity={darkMode ? 0.75 : 0.82}
                stroke={isStepTarget ? '#F59E0B' : isSelected || onPath ? '#2563EB' : buildingStroke}
                strokeWidth={isStepTarget ? 4 : isSelected || onPath ? 3 : 1.5}
                className="cursor-pointer"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => handleBuildingClick(b, e)}
                style={{
                  filter: isStepTarget
                    ? 'drop-shadow(0 0 10px rgba(245,158,11,0.8))'
                    : isSelected
                      ? 'drop-shadow(0 0 8px rgba(37,99,235,0.6))'
                      : undefined,
                }}
              />
              <text
                x={b.center[0]}
                y={b.center[1]}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={b.code.length > 4 ? 9 : 11}
                fontWeight="700"
                fill={darkMode ? '#f8fafc' : '#0f172a'}
                pointerEvents="none"
              >
                {b.code}
              </text>
            </g>
          );
        })}
      </svg>

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

      <div className="absolute bottom-24 md:bottom-4 right-3 flex flex-col gap-2 z-[20]">
        {displayRoutes.length > 0 && (
          <button
            type="button"
            className="cf-glass w-10 h-10 rounded-xl shadow-lg flex items-center justify-center"
            onClick={() => {
              const coords = displayRoutes[displayRoutes.length - 1]?.result?.planCoords;
              if (coords) fitToPlanCoords(coords);
            }}
            aria-label="Voir tout l'itinéraire"
            title="Voir l'itinéraire"
          >
            <Maximize2 size={16} className="text-[#2563EB]" />
          </button>
        )}
        <button type="button" className="cf-glass w-10 h-10 rounded-xl font-bold text-lg shadow-lg" onClick={() => zoomBy(0.8)} aria-label="Zoom avant">+</button>
        <button type="button" className="cf-glass w-10 h-10 rounded-xl font-bold text-lg shadow-lg" onClick={() => zoomBy(1.25)} aria-label="Zoom arrière">−</button>
        <button
          type="button"
          className="cf-glass w-10 h-10 rounded-xl shadow-lg flex items-center justify-center"
          onClick={() => setViewBox({ x: 0, y: 0, w: VB.width, h: VB.height })}
          aria-label="Recentrer le plan"
        >
          <Crosshair size={16} className="text-[#2563EB]" />
        </button>
      </div>
    </div>
  );
}

export default memo(CampusPlanView);
