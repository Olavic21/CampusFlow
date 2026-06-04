import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';

import CampusMap from './components/CampusMap';
import PathFinder from './components/PathFinder';
import ControlPanel, { StatsModal, ToastAlert } from './components/ControlPanel';
import HistoryDrawer from './components/HistoryDrawer';
import { useCongestion } from './hooks/useCongestion';
import { usePathfinder } from './hooks/usePathfinder';
import { useSimulation } from './hooks/useSimulation';
import { useMediaQuery } from './hooks/useMediaQuery';

export default function App() {
  const isMobile = !useMediaQuery('(min-width: 768px)');
  const simulation = useSimulation();
  const { buildings, occupancy, offline, globalStats } = useCongestion(simulation.simulatedTime);
  const pathfinder = usePathfinder(buildings, occupancy);

  const [filters, setFilters] = useState({
    types: ['amphi', 'labo', 'salle', 'admin'],
    congestion: 'all',
    heatmapOnly: false,
  });
  const [darkMode, setDarkMode] = useState(false);
  const [flyToBuilding, setFlyToBuilding] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [historyBuilding, setHistoryBuilding] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [pathfinderOpen, setPathfinderOpen] = useState(!isMobile);
  const [toasts, setToasts] = useState([]);
  const prevSatureRef = useRef({});
  const mapRef = useRef(null);
  const prevPathRef = useRef(null);

  // Saturation alerts
  useEffect(() => {
    for (const b of buildings) {
      const taux = occupancy[b.id]?.taux ?? 0;
      const wasSature = prevSatureRef.current[b.id];
      if (taux > 0.9 && !wasSature) {
        setToasts((t) => [
          ...t,
          { id: Date.now() + b.id, message: `🔴 ALERTE — ${b.nom} vient d'atteindre ${Math.round(taux * 100)}% de capacité` },
        ]);
      }
      prevSatureRef.current[b.id] = taux > 0.9;
    }
  }, [occupancy, buildings]);

  // Auto-recalculate path on congestion change
  useEffect(() => {
    if (!pathfinder.result || !pathfinder.startId || !pathfinder.endId) return;
    let cancelled = false;
    (async () => {
      const newResult = await pathfinder.computePath();
      if (cancelled || !newResult) return;
      if (prevPathRef.current && JSON.stringify(newResult.path) !== JSON.stringify(prevPathRef.current)) {
        setToasts((t) => [
          ...t,
          { id: Date.now() + 1, message: "⚠️ Chemin recalculé — congestion modifiée sur l'itinéraire" },
        ]);
      }
      prevPathRef.current = newResult.path;
    })();
    return () => { cancelled = true; };
  }, [occupancy]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchSelect = useCallback((building) => {
    setFlyToBuilding(building);
    setSelectedBuilding(building);
    setTimeout(() => setFlyToBuilding(null), 1000);
  }, []);

  const handleNavigate = useCallback((building) => {
    pathfinder.setEndId(building.id);
    setPathfinderOpen(true);
  }, [pathfinder]);

  const handleExport = useCallback(async () => {
    const el = mapRef.current;
    if (!el) return;
    const canvas = await html2canvas(el, { useCORS: true, allowTaint: true });
    const link = document.createElement('a');
    link.download = 'campusflow-carte.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  const dismissToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <div className={`flex flex-col md:flex-row w-full overflow-hidden ${darkMode ? 'dark bg-slate-900' : 'bg-slate-100'}`} style={{ height: '100dvh' }}>
      {/* PathFinder sidebar / bottom sheet */}
      <PathFinder
        buildings={buildings}
        startId={pathfinder.startId}
        endId={pathfinder.endId}
        setStartId={pathfinder.setStartId}
        setEndId={pathfinder.setEndId}
        result={pathfinder.result}
        computePath={pathfinder.computePath}
        clearPath={pathfinder.clearPath}
        collapsed={isMobile && !pathfinderOpen}
        onToggle={() => setPathfinderOpen((o) => !o)}
      />

      {/* Map area */}
      <div className="flex-1 relative min-h-0">
        <ControlPanel
          buildings={buildings}
          filters={filters}
          setFilters={setFilters}
          simulation={simulation}
          globalStats={globalStats}
          onSearchSelect={handleSearchSelect}
          onStatsOpen={() => setShowStats(true)}
          onExport={handleExport}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />

        <CampusMap
          buildings={buildings}
          occupancy={occupancy}
          globalStats={globalStats}
          offline={offline}
          formattedTime={simulation.formattedTime}
          filters={filters}
          pathResult={pathfinder.result}
          darkMode={darkMode}
          flyToBuilding={flyToBuilding}
          selectedBuilding={selectedBuilding}
          onBuildingSelect={setSelectedBuilding}
          onNavigate={handleNavigate}
          onHistory={setHistoryBuilding}
          mapRef={mapRef}
        />
      </div>

      <HistoryDrawer building={historyBuilding} onClose={() => setHistoryBuilding(null)} />

      <AnimatePresence>
        {showStats && (
          <StatsModal
            globalStats={globalStats}
            occupancy={occupancy}
            onClose={() => setShowStats(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toasts.map((t) => (
          <ToastAlert key={t.id} message={t.message} onClose={() => dismissToast(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
