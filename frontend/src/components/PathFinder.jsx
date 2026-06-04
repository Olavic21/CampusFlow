import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Route, Navigation, AlertTriangle, GitCompare, Star } from 'lucide-react';
import NavigationGuide from './navigation/NavigationGuide';

function PathFinder({
  buildings,
  startId,
  endId,
  setStartId,
  setEndId,
  result,
  routes = [],
  routeMode = 'single',
  setRouteMode,
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
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="fixed bottom-20 left-4 z-[500] md:hidden cf-menu-card px-4 py-3 text-sm font-semibold text-[#2563EB] flex items-center gap-2"
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
      className="w-full md:w-80 shrink-0 cf-glass border-r border-white/30 dark:border-slate-700/50 flex flex-col overflow-hidden z-[450]
        fixed md:relative bottom-0 md:bottom-auto left-0 right-0 md:left-auto md:right-auto
        max-h-[50vh] md:max-h-none rounded-t-[24px] md:rounded-none shadow-2xl md:shadow-none"
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
        <p className="text-[11px] text-slate-500 mt-0.5">Évite les zones saturées</p>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto flex-1 sidebar-scroll">
        {!navigationMode && (
          <>
            <div>
              <label htmlFor="path-start" className="cf-menu-label">
                Départ
              </label>
              <select
                id="path-start"
                value={startId ?? ''}
                onChange={(e) => setStartId(Number(e.target.value) || null)}
                className="cf-menu-input mt-1"
              >
                <option value="">— Choisir —</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nom}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="path-end" className="cf-menu-label">
                Arrivée
              </label>
              <select
                id="path-end"
                value={endId ?? ''}
                onChange={(e) => setEndId(Number(e.target.value) || null)}
                className="cf-menu-input mt-1"
              >
                <option value="">— Choisir —</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nom}
                  </option>
                ))}
              </select>
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

            {routeMode === 'compare' && routes.length > 0 && (
              <ul className="space-y-1.5">
                {routes.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setActiveRouteId?.(r.id)}
                      className={`w-full text-left text-xs px-3 py-2 rounded-xl flex items-center gap-2 transition-all
                        ${activeRouteId === r.id ? 'ring-2 ring-[#2563EB]/50 bg-slate-50 dark:bg-slate-800' : ''}`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                      <span className="truncate">{r.label}</span>
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
                onClick={clearPath}
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
