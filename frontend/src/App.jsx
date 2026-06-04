import { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';

import { useAuth } from './context/AuthContext';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import { SkeletonList } from './components/ui/Skeleton';
import {
  saveRouteHistory,
  getFavoriteLocations,
  addFavoriteLocation,
  removeFavoriteLocation,
  addFavoriteRoute,
} from './services/authApi';
import CampusMap from './components/CampusMap';
import PathFinder from './components/PathFinder';
import ControlPanel from './components/ControlPanel';
import ToastStack from './components/ToastStack';
import MapLoadingOverlay from './components/MapLoadingOverlay';
import SplashScreen from './components/SplashScreen';
import AppNav from './components/AppNav';
import BrandLogo from './components/brand/BrandLogo';
import BuildingSheet from './components/BuildingSheet';
import StatsDashboard from './components/StatsDashboard';
import BuildingsList from './components/BuildingsList';
import SettingsPanel from './components/SettingsPanel';
import { useCongestion } from './hooks/useCongestion';
import { usePathfinder } from './hooks/usePathfinder';
import { useSimulation } from './hooks/useSimulation';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useToast } from './hooks/useToast';
import { useTheme } from './hooks/useTheme';
import { buildNavigationSteps } from './utils/navigationSteps';
import { resolveBuilding } from './utils/buildingSafety';

const HistoryDrawer = lazy(() => import('./components/HistoryDrawer'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

function parseSimulationHour(formattedTime) {
  const m = String(formattedTime || '').match(/(\d{1,2})/);
  const h = m ? parseInt(m[1], 10) : 9;
  return Number.isFinite(h) ? h : 9;
}

export default function App() {
  const { loading: authLoading, isAuthenticated, authView } = useAuth();

  if (authLoading) {
    return (
      <div className="auth-shell items-center justify-center flex-col gap-2">
        <p className="text-sm text-slate-500 animate-pulse">Chargement…</p>
        <p className="text-xs text-slate-400 max-w-xs text-center">
          Connexion au serveur (max. 8 s)
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return authView === 'register' ? <RegisterPage /> : <LoginPage />;
  }

  return <CampusFlowMain />;
}

function CampusFlowMain() {
  const { user, logout } = useAuth();
  const isMobile = !useMediaQuery('(min-width: 768px)');
  const { darkMode, setDarkMode, toggleDarkMode } = useTheme();
  const simulation = useSimulation();
  const { buildings, occupancy, offline, loading, globalStats } = useCongestion(
    simulation.simulatedTime,
  );
  const pathfinder = usePathfinder(buildings, occupancy);
  const { toasts, push, dismiss } = useToast();

  const [activeView, setActiveView] = useState('map');
  const [showSplash, setShowSplash] = useState(true);
  const [navigationMode, setNavigationMode] = useState(false);
  const [guideStepIndex, setGuideStepIndex] = useState(0);
  const [flyToCoords, setFlyToCoords] = useState(null);
  const [filters, setFilters] = useState({
    types: ['amphi', 'labo', 'salle', 'admin'],
    congestion: 'all',
    heatmapOnly: false,
  });
  const [flyToBuilding, setFlyToBuilding] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [historyBuilding, setHistoryBuilding] = useState(null);
  const [pathfinderOpen, setPathfinderOpen] = useState(false);
  const prevSatureRef = useRef({});
  const mapRef = useRef(null);
  const prevPathRef = useRef(null);
  const prevOfflineRef = useRef(null);
  const [favByLocation, setFavByLocation] = useState({});

  useEffect(() => {
    if (!user) {
      setFavByLocation({});
      return;
    }
    getFavoriteLocations()
      .then((list) => {
        const m = {};
        for (const f of list) m[f.location_id] = f.id;
        setFavByLocation(m);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem('cf_just_registered')) {
      push('success', 'Compte créé avec succès');
      sessionStorage.removeItem('cf_just_registered');
    } else if (sessionStorage.getItem('cf_just_logged_in')) {
      push('success', 'Bienvenue sur CampusFlow Lite');
      sessionStorage.removeItem('cf_just_logged_in');
    }
  }, [user, push]);

  const handleToggleFavorite = useCallback(
    async (building) => {
      if (!user || !building?.id) return;
      try {
        if (favByLocation[building.id]) {
          await removeFavoriteLocation(favByLocation[building.id]);
          setFavByLocation((prev) => {
            const next = { ...prev };
            delete next[building.id];
            return next;
          });
          push('info', 'Retiré des favoris');
        } else {
          const fav = await addFavoriteLocation(building.id, building.nom);
          setFavByLocation((prev) => ({ ...prev, [building.id]: fav.id }));
          push('success', `⭐ ${building.nom} en favoris`);
        }
      } catch (e) {
        push('error', e.message || 'Impossible de modifier les favoris');
      }
    },
    [user, favByLocation, push],
  );

  const simulationHour = useMemo(
    () => parseSimulationHour(simulation.formattedTime),
    [simulation.formattedTime],
  );

  const guideSteps = useMemo(
    () => buildNavigationSteps(pathfinder.result),
    [pathfinder.result],
  );

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setShowSplash(false), 600);
      return () => clearTimeout(t);
    }
  }, [loading]);

  useEffect(() => {
    if (offline && prevOfflineRef.current !== true) {
      push('info', 'Mode hors ligne — données locales du campus', 5000);
    }
    prevOfflineRef.current = offline;
  }, [offline, push]);

  useEffect(() => {
    for (const b of buildings) {
      const taux = occupancy[b.id]?.taux ?? 0;
      const wasSature = prevSatureRef.current[b.id];
      if (taux > 0.9 && !wasSature) {
        push('saturation', `${b.nom} — ${Math.round(taux * 100)}% de capacité`);
      }
      prevSatureRef.current[b.id] = taux > 0.9;
    }
  }, [occupancy, buildings, push]);

  useEffect(() => {
    if (
      !navigationMode ||
      !pathfinder.routes.length ||
      !pathfinder.startId ||
      !pathfinder.endId
    ) {
      return;
    }
    let cancelled = false;
    (async () => {
      const newResult = await pathfinder.updateActiveRouteResult();
      if (cancelled || !newResult) return;
      if (
        prevPathRef.current &&
        JSON.stringify(newResult.path) !== JSON.stringify(prevPathRef.current)
      ) {
        push('warning', "Chemin recalculé — la congestion a changé sur l'itinéraire");
      }
      prevPathRef.current = newResult.path;
    })();
    return () => {
      cancelled = true;
    };
  }, [occupancy, navigationMode, pathfinder.routes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const exitNavigation = useCallback(() => {
    setNavigationMode(false);
    setGuideStepIndex(0);
    pathfinder.clearPath();
    prevPathRef.current = null;
    if (activeView === 'route') setPathfinderOpen(true);
  }, [pathfinder, activeView]);

  const handleViewChange = useCallback(
    (view) => {
      setActiveView(view);
      if (view === 'route') setPathfinderOpen(true);
      else if (view === 'map' && !navigationMode) setPathfinderOpen(false);
    },
    [navigationMode],
  );

  const focusBuilding = useCallback((building) => {
    const b = resolveBuilding(building, buildings);
    if (!b) return;
    setFlyToBuilding(b);
    setFlyToCoords([b.latitude, b.longitude]);
    setTimeout(() => {
      setFlyToBuilding(null);
      setFlyToCoords(null);
    }, 1200);
  }, [buildings]);

  const handleBuildingSelect = useCallback(
    (building) => {
      try {
        const resolved = resolveBuilding(building, buildings);
        if (!resolved) {
          push('warning', 'Impossible d\'afficher ce bâtiment');
          return;
        }
        setSelectedBuilding(resolved);
        setActiveView('map');
        focusBuilding(resolved);
      } catch (e) {
        console.error('[CampusFlow] select building', e);
        push('error', 'Erreur lors de l\'ouverture de la fiche');
      }
    },
    [buildings, focusBuilding, push],
  );

  const handleGuideStepSelect = useCallback(
    (index, building) => {
      setGuideStepIndex(index);
      if (building) focusBuilding(building);
    },
    [focusBuilding],
  );

  const handleNavigate = useCallback(
    (building) => {
      try {
        const resolved = resolveBuilding(building, buildings);
        if (!resolved) return;
        pathfinder.setEndId(resolved.id);
        setActiveView('route');
        setPathfinderOpen(true);
        setSelectedBuilding(null);
        push('info', `Destination : ${resolved.nom}`);
      } catch (e) {
        console.error('[CampusFlow] navigate', e);
      }
    },
    [pathfinder, buildings, push],
  );

  const startNavigation = useCallback(
    (res) => {
      setNavigationMode(true);
      setGuideStepIndex(0);
      setActiveView('map');
      if (isMobile) setPathfinderOpen(true);
      prevPathRef.current = res?.path ?? null;
    },
    [isMobile],
  );

  const handleComputePath = useCallback(async () => {
    try {
      const res = await pathfinder.computePath();
      if (!res?.path?.length) {
        push('error', 'Aucun itinéraire trouvé entre ces deux points');
        return;
      }
      startNavigation(res);
      push('success', `Navigation — ${res.totalDistance} m, ~${res.estimatedMinutes} min`);
      if (user && pathfinder.startId && pathfinder.endId) {
        saveRouteHistory({
          start_location_id: pathfinder.startId,
          end_location_id: pathfinder.endId,
          distance_m: res.totalDistance ?? 0,
          duration_min: res.estimatedMinutes,
        }).catch(() => {});
      }
    } catch (e) {
      console.error('[CampusFlow] compute path', e);
      push('error', 'Erreur lors du calcul d\'itinéraire');
    }
  }, [pathfinder, push, startNavigation, user]);

  const handleQuickRoute = useCallback(
    async (building) => {
      try {
        const resolved = resolveBuilding(building, buildings);
        if (!resolved) return;

        if (!pathfinder.startId) {
          pathfinder.setEndId(resolved.id);
          setActiveView('route');
          setPathfinderOpen(true);
          push('info', 'Choisissez un point de départ puis calculez le chemin');
          return;
        }
        pathfinder.setEndId(resolved.id);
        const res = await pathfinder.computePath();
        if (!res?.path?.length) {
          push('error', 'Itinéraire impossible');
          return;
        }
        startNavigation(res);
        focusBuilding(resolved);
      } catch (e) {
        console.error('[CampusFlow] quick route', e);
        push('error', 'Impossible de créer l\'itinéraire');
      }
    },
    [pathfinder, buildings, push, startNavigation, focusBuilding],
  );

  const handleSaveRouteFavorite = useCallback(async () => {
    if (!user || !pathfinder.startId || !pathfinder.endId) return;
    try {
      await addFavoriteRoute({
        start_location_id: pathfinder.startId,
        end_location_id: pathfinder.endId,
        distance_m: pathfinder.result?.totalDistance ?? 0,
      });
      push('success', 'Itinéraire enregistré en favori');
    } catch (e) {
      push('error', e.message || 'Déjà en favoris ou erreur serveur');
    }
  }, [user, pathfinder.startId, pathfinder.endId, pathfinder.result, push]);

  const handleExport = useCallback(async () => {
    const el = mapRef.current;
    if (!el) return;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(el, { useCORS: true, allowTaint: true });
      const link = document.createElement('a');
      link.download = 'campusflow-carte.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      push('success', 'Carte exportée en PNG');
    } catch {
      push('error', "Impossible d'exporter la carte");
    }
  }, [push]);

  const showMapChrome = (activeView === 'map' || activeView === 'route') && !navigationMode;
  const showPathPanel =
    (activeView === 'route' || navigationMode) && (!isMobile || pathfinderOpen);

  return (
    <div
      className={`flex w-full overflow-hidden ${darkMode ? 'dark' : ''} bg-slate-100 dark:bg-[#1F2937]`}
      style={{ height: '100dvh' }}
    >
      <AnimatePresence>{showSplash && <SplashScreen visible />}</AnimatePresence>

      {!isMobile && (
        <AppNav
          activeView={activeView}
          onViewChange={handleViewChange}
          isMobile={false}
          user={user}
          onProfile={() => setActiveView('profile')}
          onLogout={async () => {
            await logout();
            push('info', 'Vous êtes déconnecté');
          }}
        />
      )}

      <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${isMobile ? 'pb-[72px]' : ''}`}>
        {isMobile && (activeView === 'map' || activeView === 'route') && (
          <div className="shrink-0 cf-glass border-b border-white/20 px-4 py-2.5 flex items-center justify-center z-[400]">
            <BrandLogo variant="mobile" />
          </div>
        )}

        {activeView === 'stats' && (
          <StatsDashboard globalStats={globalStats} occupancy={occupancy} buildings={buildings} />
        )}

        {activeView === 'buildings' && (
          <BuildingsList
            buildings={buildings}
            occupancy={occupancy}
            onSelect={handleBuildingSelect}
            onRouteFrom={handleQuickRoute}
          />
        )}

        {activeView === 'profile' && (
          <Suspense fallback={<div className="flex-1 p-4"><SkeletonList count={4} /></div>}>
            <ProfilePage
              darkMode={darkMode}
              onToggleTheme={setDarkMode}
              routeMode={pathfinder.routeMode}
              onRouteModeChange={pathfinder.setRouteMode}
              onToast={push}
            />
          </Suspense>
        )}

        {activeView === 'settings' && (
          <SettingsPanel
            darkMode={darkMode}
            onToggleTheme={toggleDarkMode}
            offline={offline}
            filters={filters}
            setFilters={setFilters}
            onExport={handleExport}
          />
        )}

        {(activeView === 'map' || activeView === 'route') && (
          <div className="flex flex-1 min-h-0 flex-col md:flex-row relative">
            {showPathPanel && (
              <PathFinder
                buildings={buildings}
                startId={pathfinder.startId}
                endId={pathfinder.endId}
                setStartId={pathfinder.setStartId}
                setEndId={pathfinder.setEndId}
                result={pathfinder.result}
                routes={pathfinder.routes}
                routeMode={pathfinder.routeMode}
                setRouteMode={pathfinder.setRouteMode}
                activeRouteId={pathfinder.activeRouteId}
                setActiveRouteId={pathfinder.setActiveRouteId}
                computePath={handleComputePath}
                clearPath={exitNavigation}
                pathLoading={pathfinder.pathLoading}
                usingApi={pathfinder.usingApi}
                collapsed={false}
                onToggle={() => setPathfinderOpen(false)}
                navigationMode={navigationMode}
                guideSteps={guideSteps}
                activeStepIndex={guideStepIndex}
                onStepSelect={handleGuideStepSelect}
                onSaveRouteFavorite={user ? handleSaveRouteFavorite : undefined}
              />
            )}

            <div className="flex-1 relative min-h-0">
              {showMapChrome && (
                <ControlPanel
                  buildings={buildings}
                  filters={filters}
                  setFilters={setFilters}
                  simulation={simulation}
                  onSearchSelect={handleBuildingSelect}
                  onExport={handleExport}
                  darkMode={darkMode}
                  setDarkMode={setDarkMode}
                  loading={loading}
                  compact={isMobile}
                />
              )}

              <CampusMap
                buildings={buildings}
                occupancy={occupancy}
                globalStats={globalStats}
                offline={offline}
                formattedTime={simulation.formattedTime}
                filters={filters}
                routes={pathfinder.routes}
                activeRouteId={pathfinder.activeRouteId}
                routeMode={pathfinder.routeMode}
                darkMode={darkMode}
                flyToBuilding={flyToBuilding}
                flyToCoords={flyToCoords}
                selectedBuilding={selectedBuilding}
                onBuildingSelect={handleBuildingSelect}
                mapRef={mapRef}
                navigationMode={navigationMode}
                onExitNavigation={exitNavigation}
                guideStepIndex={guideStepIndex}
                guideSteps={guideSteps}
                pathIdsOnMap={pathfinder.pathIdsOnMap}
                onSelectRoute={pathfinder.setActiveRouteId}
                onRemoveRoute={pathfinder.removeRoute}
              />

              <MapLoadingOverlay visible={loading} />
            </div>
          </div>
        )}

        {isMobile && activeView === 'route' && !pathfinderOpen && !navigationMode && (
          <button
            type="button"
            onClick={() => setPathfinderOpen(true)}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[480] cf-menu-card px-5 py-2.5 text-sm font-semibold text-[#2563EB]"
          >
            Ouvrir l&apos;itinéraire
          </button>
        )}
      </div>

      {isMobile && (
        <AppNav
          activeView={activeView}
          onViewChange={handleViewChange}
          isMobile
          user={user}
          onProfile={() => setActiveView('profile')}
          onLogout={async () => {
            await logout();
            push('info', 'Vous êtes déconnecté');
          }}
        />
      )}

      <BuildingSheet
        building={selectedBuilding}
        occupancy={occupancy}
        currentHour={simulationHour}
        onClose={() => setSelectedBuilding(null)}
        onNavigate={handleNavigate}
        isFavorite={selectedBuilding ? !!favByLocation[selectedBuilding.id] : false}
        onToggleFavorite={user ? handleToggleFavorite : undefined}
        onHistory={(b) => {
          setSelectedBuilding(null);
          setHistoryBuilding(resolveBuilding(b, buildings));
        }}
      />

      <Suspense fallback={null}>
        <HistoryDrawer building={historyBuilding} onClose={() => setHistoryBuilding(null)} />
      </Suspense>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
