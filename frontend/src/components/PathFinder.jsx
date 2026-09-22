import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Route, Navigation, AlertTriangle, GitCompare, Star, Zap, ShieldCheck } from 'lucide-react';
import NavigationGuide from './navigation/NavigationGuide';
import RouteBuildingPicker from './routes/RouteBuildingPicker';

function PathFinder({
  buildings,
  occupancy = {},
  startId,
  endId,
  setStartId,
  setEndId,
  result,
  routes = [],
  routeMode = 'single',
  setRouteMode,
  profile = 'calm',
  onProfileChange,
  activeRouteId,
  setActiveRouteId,
  computePath,
  clearPath,
  pathLoading = false,
  usingApi = false,
  collapsed = false,
  onToggle,
  navigationMode = false,
  guideSteps = [],
  activeStepIndex = 0,
  onStepSelect,
  onSaveRouteFavorite,
}) {
  const [startTwinId, setStartTwinId] = useState(null);
  const [endTwinId, setEndTwinId] = useState(null);

  const handleStartChange = useCallback(
    (routeId, twinId) => {
      setStartId(routeId);
      setStartTwinId(twinId);
    },
    [setStartId],
  );

  const handleEndChange = useCallback(
    (routeId, twinId) => {
      setEndId(routeId);
      setEndTwinId(twinId);
    },
    [setEndId],
  );

  const handleClearPath = useCallback(() => {
    setStartTwinId(null);
    setEndTwinId(null);
    clearPath?.();
  }, [clearPath]);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="fixed left-4 z-[480] md:hidden cf-menu-card px-4 py-3 text-sm font-semibold text-[#2563EB] flex items-center gap-2"
        style={{ bottom: 'calc(var(--nav-h-safe) + 12px)' }}
        aria-label="Ouvrir le panneau itinéraire"
      >
        <Route size={18} strokeWidth={2} />
        Itinéraire
      </button>
    );
  }

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-full md:w-80 shrink-0 cf-glass border-r border-white/30 dark:border-slate-700/50 flex flex-col overflow-hidden z-[520]
        fixed md:relative left-0 right-0 md:left-auto md:right-auto
        max-h-[50vh] md:max-h-none rounded-t-[24px] md:rounded-none shadow-2xl md:shadow-none"
      style={{ bottom: 'var(--nav-h-safe)' }}
      aria-label="Calculateur d'itinéraire piéton"
    >
      <div className="md:hidden flex justify-center pt-3 pb-1">
        <button
          type="button"
          onClick={onToggle}
          className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full"
          aria-label="Replier"
        />
      </div>

      <div className="px-4 py-3 border-b border-slate-200/50 dark:border-slate-700/50 shrink-0">
        <h2 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
          <Route size={18} className="text-[#2563EB]" strokeWidth={2} />
          Itinéraire piéton
        </h2>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {profile === 'calm' ? 'Profil : évite l’affluence' : 'Profil : le plus rapide'}
        </p>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto flex-1 sidebar-scroll">
        {!navigationMode && (
          <>
            <RouteBuildingPicker
              id="path-start"
              label="Départ"
              value={startId}
              twinId={startTwinId}
              geoBuildings={buildings}
              occupancy={occupancy}
              onChange={handleStartChange}
            />

            <RouteBuildingPicker
              id="path-end"
              label="Arrivée"
              value={endId}
              twinId={endTwinId}
              geoBuildings={buildings}
              occupancy={occupancy}
              onChange={handleEndChange}
            />

            <div className="cf-stat-chip p-3 space-y-2">
              <p className="cf-menu-label">Profil d&apos;itinéraire</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onProfileChange?.('calm')}
                  aria-pressed={profile === 'calm'}
                  className={`flex-1 text-xs py-2 rounded-xl font-medium transition-all duration-[250ms] flex items-center justify-center gap-1
                    ${profile === 'calm' ? 'bg-[#2563EB] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}
                >
                  <ShieldCheck size={12} strokeWidth={2} />
                  Éviter l&apos;affluence
                </button>
                <button
                  type="button"
                  onClick={() => onProfileChange?.('fast')}
                  aria-pressed={profile === 'fast'}
                  className={`flex-1 text-xs py-2 rounded-xl font-medium transition-all duration-[250ms] flex items-center justify-center gap-1
                    ${profile === 'fast' ? 'bg-[#2563EB] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}
                >
                  <Zap size={12} strokeWidth={2} />
                  Le plus rapide
                </button>
              </div>
            </div>

            <div className="cf-stat-chip p-3 space-y-2">
              <p className="cf-menu-label">Mode affichage</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRouteMode?.('single')}
                  className={`flex-1 text-xs py-2 rounded-xl font-medium transition-all duration-[250ms]
                    ${routeMode === 'single' ? 'bg-[#2563EB] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}
                >
                  Un seul chemin
                </button>
                <button
                  type="button"
                  onClick={() => setRouteMode?.('compare')}
                  className={`flex-1 text-xs py-2 rounded-xl font-medium transition-all duration-[250ms] flex items-center justify-center gap-1
                    ${routeMode === 'compare' ? 'bg-[#2563EB] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}
                >
                  <GitCompare size={12} strokeWidth={2} />
                  Comparer (3 max)
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={computePath}
              disabled={!startId || !endId || pathLoading}
              className="cf-btn-primary w-full flex items-center justify-center gap-2"
              aria-busy={pathLoading}
            >
              <Navigation size={18} strokeWidth={2} />
              {pathLoading ? 'Calcul en cours…' : 'Calculer le chemin'}
            </button>

            {routes.length > 0 && (
              <ul className="space-y-1.5" aria-label="Options d'itinéraire">
                {routes.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setActiveRouteId?.(r.id)}
                      className={`w-full text-left text-xs px-3 py-2 rounded-xl flex items-center gap-2 transition-all
                        ${activeRouteId === r.id ? 'ring-2 ring-[#2563EB]/50 bg-slate-50 dark:bg-slate-800' : ''}`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate font-semibold">{r.tag ?? r.label}</span>
                        {r.result && (
                          <span className="block text-[10px] text-slate-400">
                            {r.result.totalDistance} m · ~{r.result.estimatedMinutes} min
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border-t border-slate-200/80 dark:border-slate-700/50 pt-3"
            >
              {navigationMode ? (
                <NavigationGuide
                  steps={guideSteps}
                  activeStepIndex={activeStepIndex}
                  onStepSelect={onStepSelect}
                />
              ) : (
                <>
                  {result.hasSaturated && (
                    <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-xl px-3 py-2 mb-2 flex items-center gap-2">
                      <AlertTriangle size={14} strokeWidth={2} />
                      Zone saturée sur le trajet
                    </p>
                  )}
                  <dl className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between cf-stat-chip p-2">
                      <dt>Distance</dt>
                      <dd className="font-bold">{result.totalDistance} m</dd>
                    </div>
                    <div className="flex justify-between cf-stat-chip p-2">
                      <dt>Temps</dt>
                      <dd className="font-bold">~{result.estimatedMinutes} min</dd>
                    </div>
                  </dl>
                </>
              )}
              {onSaveRouteFavorite && result && (
                <button
                  type="button"
                  onClick={onSaveRouteFavorite}
                  className="cf-btn-secondary w-full mt-2 flex items-center justify-center gap-2"
                >
                  <Star size={16} strokeWidth={2} />
                  Enregistrer l&apos;itinéraire en favori
                </button>
              )}
              <button
                type="button"
                onClick={handleClearPath}
                className="cf-btn-danger w-full mt-3"
              >
                {navigationMode ? 'Quitter la navigation' : 'Effacer le chemin'}
              </button>
              {usingApi && !navigationMode && (
                <p className="text-[10px] text-slate-400 pt-2 text-center">Calcul serveur</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}

export default memo(PathFinder);
