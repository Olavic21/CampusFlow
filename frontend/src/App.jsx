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
import PathFinder from './components/PathFinder';
import ControlPanel from './components/ControlPanel';
import ToastStack from './components/ToastStack';
import MapLoadingOverlay from './components/MapLoadingOverlay';
import SplashScreen from './components/SplashScreen';
import AppNav from './components/AppNav';
import BrandLogo from './components/brand/BrandLogo';
import BuildingSheet from './components/BuildingSheet';
import SettingsPanel from './components/SettingsPanel';
import { useCongestion } from './hooks/useCongestion';
import { SensorDataProvider } from './context/SensorDataContext';
import SensorModeBadge from './components/iot/SensorModeBadge';
import { usePathfinder } from './hooks/usePathfinder';
import { useSimulation } from './hooks/useSimulation';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useToast } from './hooks/useToast';
import { useTheme } from './hooks/useTheme';
import { buildNavigationSteps } from './utils/navigationSteps';
import { resolveBuilding, safeOccupancy } from './utils/buildingSafety';
import CampusLayoutEngine from './engine/CampusLayoutEngine';

const CampusMap = lazy(() => import('./components/CampusMap'));
const CampusPlanView = lazy(() => import('./components/plan/CampusPlanView'));
const StatsDashboard = lazy(() => import('./components/StatsDashboard'));
const BuildingsList = lazy(() => import('./components/BuildingsList'));
const HistoryDrawer = lazy(() => import('./components/HistoryDrawer'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const IoTSupervisionPage = lazy(() => import('./pages/IoTSupervisionPage'));

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
  const simulation = useSimulation();
  return (
    <SensorDataProvider simulatedTime={simulation.simulatedTime}>
      <CampusFlowShell simulation={simulation} />
    </SensorDataProvider>
  );
}

function CampusFlowShell({ simulation }) {
  const { user, logout } = useAuth();
  const isMobile = !useMediaQuery('(min-width: 768px)');
  const { darkMode, setDarkMode, toggleDarkMode } = useTheme();
  const { buildings, occupancy, offline, loading, globalStats } = useCongestion();
  const pathfinder = usePathfinder(buildings, occupancy);
  const { toasts, push, dismiss } = useToast();

  const [activeView, setActiveView] = useState('map');
  const [showSplash, setShowSplash] = useState(true);
  const [navigationMode, setNavigationMode] = useState(false);
  const [guideStepIndex, setGuideStepIndex] = useState(0);
  const [stepFocusToken, setStepFocusToken] = useState(0);
  const [flyToCoords, setFlyToCoords] = useState(null);
  const [filters, setFilters] = useState({
    types: ['amphi', 'labo', 'salle', 'admin', 'dortoir', 'service', 'sport'],
    congestion: 'all',
    heatmapOnly: false,
  });
  const [flyToBuilding, setFlyToBuilding] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [historyBuilding, setHistoryBuilding] = useState(null);
  const [pathfinderOpen, setPathfinderOpen] = useState(false);
  const [mapViewMode, setMapViewMode] = useState('campus');
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
    const campusBuildings = CampusLayoutEngine.getGpsBuildings(occupancy, buildings);
    for (const b of campusBuildings) {
      const key = b.geoId ?? b.id;
      const taux = safeOccupancy(occupancy, b).taux;
      const wasSature = prevSatureRef.current[key];
      if (taux > 0.9 && !wasSature) {
        push('saturation', `${b.code || b.nom} — ${Math.round(taux * 100)}% de capacité`);
      }
      prevSatureRef.current[key] = taux > 0.9;
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
    const b = resolveBuilding(building, buildings, occupancy);
    if (!b) return;
    setFlyToBuilding(b);
    if (b.latitude != null && b.longitude != null && mapViewMode === 'gps') {
      setFlyToCoords([b.latitude, b.longitude]);
    }
    setTimeout(() => {
      setFlyToBuilding(null);
      setFlyToCoords(null);
    }, 1200);
  }, [buildings, occupancy, mapViewMode]);

  const handleBuildingSelect = useCallback(
    (building) => {
      try {
        const resolved = resolveBuilding(building, buildings, occupancy);
        if (!resolved) {
          push('warning', 'Impossible d\'afficher ce bâtiment');
          return;
        }
        if (navigationMode) {
          const stepIdx = guideSteps.findIndex(
            (s) =>
              s.building?.id === resolved.id ||
              s.building?.geoId === resolved.geoId ||
              s.buildingId === resolved.id ||
              s.buildingId === resolved.geoId,
          );
          if (stepIdx >= 0) {
            setGuideStepIndex(stepIdx);
            setStepFocusToken((t) => t + 1);
          }
          focusBuilding(resolved);
          return;
        }
        setSelectedBuilding(resolved);
        if (activeView !== 'map' && activeView !== 'route') {
          setActiveView('map');
        }
        focusBuilding(resolved);
      } catch (e) {
        console.error('[CampusFlow] select building', e);
        push('error', 'Erreur lors de l\'ouverture de la fiche');
      }
    },
    [buildings, occupancy, focusBuilding, push, navigationMode, guideSteps, activeView],
  );

  const handleGuideStepSelect = useCallback(
    (index, building) => {
      setGuideStepIndex(index);
      setStepFocusToken((t) => t + 1);
      if (building) focusBuilding(building);
    },
    [focusBuilding],
  );

  const handleStepPrev = useCallback(() => {
    setGuideStepIndex((i) => {
      const next = Math.max(0, i - 1);
      const b = guideSteps[next]?.building;
      if (b) focusBuilding(b);
      return next;
    });
    setStepFocusToken((t) => t + 1);
  }, [guideSteps, focusBuilding]);

  const handleStepNext = useCallback(() => {
    setGuideStepIndex((i) => {
      const next = Math.min(guideSteps.length - 1, i + 1);
      const b = guideSteps[next]?.building;
      if (b) focusBuilding(b);
      return next;
    });
    setStepFocusToken((t) => t + 1);
  }, [guideSteps, focusBuilding]);

  const pathNodes = pathfinder.campusNetwork?.nodes ?? {};

  const handleNavigate = useCallback(
    (building) => {
      try {
        const resolved = resolveBuilding(building, buildings, occupancy);
        if (!resolved) return;
        const routeId = CampusLayoutEngine.resolveRouteId(resolved, buildings);
        if (!routeId) {
          push('error', 'Ce bâtiment n\'est pas accessible en itinéraire');
          return;
        }
        pathfinder.setEndId(routeId);
        setActiveView('route');
        setPathfinderOpen(true);
        setSelectedBuilding(null);
        push('info', `Destination : ${resolved.code || resolved.nom}`);
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
      setStepFocusToken((t) => t + 1);
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
      if (
        user &&
        typeof pathfinder.startId === 'number' &&
        typeof pathfinder.endId === 'number'
      ) {
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
        const resolved = resolveBuilding(building, buildings, occupancy);
        if (!resolved) return;

        const routeId = CampusLayoutEngine.resolveRouteId(resolved, buildings);
        if (!routeId) {
          push('error', 'Ce bâtiment n\'est pas accessible en itinéraire');
          return;
        }
        if (!pathfinder.startId) {
          pathfinder.setEndId(routeId);
          setActiveView('route');
          setPathfinderOpen(true);
          push('info', 'Choisissez un point de départ puis calculez le chemin');
          return;
        }
        pathfinder.setEndId(routeId);
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
    if (
      !user ||
      typeof pathfinder.startId !== 'number' ||
      typeof pathfinder.endId !== 'number'
    ) {
      push('info', 'Favori disponible pour les bâtiments géolocalisés API');
      return;
    }
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

      <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${isMobile ? 'pb-nav' : ''}`}>
        {isMobile && (activeView === 'map' || activeView === 'route') && (
          <div className="shrink-0 cf-glass border-b border-white/20 px-4 py-2.5 flex items-center justify-center z-[400]">
            <BrandLogo variant="mobile" />
          </div>
        )}

        {activeView === 'stats' && (
          <Suspense fallback={<div className="flex-1 p-4"><SkeletonList count={6} /></div>}>
            <StatsDashboard globalStats={globalStats} occupancy={occupancy} buildings={buildings} />
          </Suspense>
        )}

        {activeView === 'buildings' && (
          <Suspense fallback={<div className="flex-1 p-4"><SkeletonList count={8} /></div>}>
            <BuildingsList
              buildings={buildings}
              occupancy={occupancy}
              onSelect={handleBuildingSelect}
              onRouteFrom={handleQuickRoute}
            />
          </Suspense>
        )}

        {activeView === 'profile' && (
          <Suspense fallback={<div className="flex-1 p-4"><SkeletonList count={4} /></div>}>
            <ProfilePage
              darkMode={darkMode}
              onToggleTheme={setDarkMode}
              routeMode={pathfinder.routeMode}
              onRouteModeChange={pathfinder.setRouteMode}
              onToast={push}
              onNavigate={(view) => setActiveView(view)}
            />
          </Suspense>
        )}

        {activeView === 'iot' && (
          <Suspense fallback={<div className="flex-1 p-4"><SkeletonList count={4} /></div>}>
            <IoTSupervisionPage onToast={push} />
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
                occupancy={occupancy}
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
                  occupancy={occupancy}
                  filters={filters}
                  setFilters={setFilters}
                  simulation={simulation}
                  onSearchSelect={handleBuildingSelect}
                  onExport={handleExport}
                  darkMode={darkMode}
                  setDarkMode={setDarkMode}
                  loading={loading}
                  compact={isMobile}
                  mapViewMode={mapViewMode}
                  onMapViewModeChange={setMapViewMode}
                />
              )}

              <Suspense fallback={<MapLoadingOverlay visible />}>
                {mapViewMode === 'campus' ? (
                  <CampusPlanView
                    buildings={buildings}
                    occupancy={occupancy}
                    selectedBuilding={selectedBuilding}
                    onBuildingSelect={handleBuildingSelect}
                    routes={pathfinder.routes}
                    activeRouteId={pathfinder.activeRouteId}
                    routeMode={pathfinder.routeMode}
                    navigationMode={navigationMode}
                    pathIdsOnMap={pathfinder.pathIdsOnMap}
                    darkMode={darkMode}
                    flyToBuilding={flyToBuilding}
                    guideSteps={guideSteps}
                    guideStepIndex={guideStepIndex}
                    pathNodes={pathNodes}
                    onExitNavigation={exitNavigation}
                    onSelectRoute={pathfinder.setActiveRouteId}
                    onRemoveRoute={pathfinder.removeRoute}
                    onStepPrev={handleStepPrev}
                    onStepNext={handleStepNext}
                  />
                ) : (
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
                    pathNodes={pathNodes}
                    onSelectRoute={pathfinder.setActiveRouteId}
                    onRemoveRoute={pathfinder.removeRoute}
                    onStepPrev={handleStepPrev}
                    onStepNext={handleStepNext}
                    stepFocusToken={stepFocusToken}
                  />
                )}
              </Suspense>

              <MapLoadingOverlay visible={loading} />

              <div className="absolute top-3 right-3 z-[450] pointer-events-none">
                <div className="pointer-events-auto">
                  <SensorModeBadge compact={isMobile} />
                </div>
              </div>
            </div>
          </div>
        )}

        {isMobile && activeView === 'route' && !pathfinderOpen && !navigationMode && (
          <button
            type="button"
            onClick={() => setPathfinderOpen(true)}
            className="fixed left-1/2 -translate-x-1/2 z-[480] cf-menu-card px-5 py-2.5 text-sm font-semibold text-[#2563EB]"
            style={{ bottom: 'calc(var(--nav-h-safe) + 12px)' }}
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
          setHistoryBuilding(resolveBuilding(b, buildings, occupancy));
        }}
      />

      <Suspense fallback={null}>
        <HistoryDrawer building={historyBuilding} onClose={() => setHistoryBuilding(null)} />
      </Suspense>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
