import { motion, AnimatePresence } from 'framer-motion';

export default function PathFinder({
  buildings,
  startId,
  endId,
  setStartId,
  setEndId,
  result,
  computePath,
  clearPath,
  collapsed = false,
  onToggle,
}) {
  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 left-4 z-[500] md:hidden bg-white rounded-2xl shadow-lg px-4 py-3 text-sm font-semibold text-blue-600"
      >
        🗺️ Itinéraire
      </button>
    );
  }

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-full md:w-72 shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden z-[450]
        fixed md:relative bottom-0 md:bottom-auto left-0 right-0 md:left-auto md:right-auto
        max-h-[45vh] md:max-h-none rounded-t-2xl md:rounded-none shadow-2xl md:shadow-none"
    >
      <div className="md:hidden flex justify-center pt-2 pb-1">
        <button onClick={onToggle} className="w-10 h-1 bg-slate-300 rounded-full" aria-label="Replier" />
      </div>

      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <h2 className="font-bold text-slate-800 text-sm">🗺️ Itinéraire piéton</h2>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto flex-1">
        <div>
          <label className="text-xs text-slate-500 font-medium">Départ</label>
          <select
            value={startId ?? ''}
            onChange={(e) => setStartId(Number(e.target.value) || null)}
            className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">— Choisir —</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.nom}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-500 font-medium">Arrivée</label>
          <select
            value={endId ?? ''}
            onChange={(e) => setEndId(Number(e.target.value) || null)}
            className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">— Choisir —</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.nom}</option>
            ))}
          </select>
        </div>

        <button
          onClick={computePath}
          disabled={!startId || !endId}
          className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition"
        >
          Calculer le chemin
        </button>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border-t border-slate-100 pt-3"
            >
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Résultat</p>
              <div className="space-y-1 text-sm">
                {result.segments.map((seg, i) => (
                  <div key={i} className="flex items-start gap-1 text-slate-700">
                    {i === 0 ? (
                      <span>📍 {seg.from.nom}</span>
                    ) : null}
                    <div className="ml-3 text-xs text-slate-500">
                      └→ {seg.to.nom} ({seg.distance}m)
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs space-y-1 text-slate-600">
                <p>Distance totale : <strong>{result.totalDistance} m</strong></p>
                <p>Temps estimé : <strong>~{result.estimatedMinutes} min</strong></p>
                <p>Congestion évitée : <strong>{result.avoidedZones} zone{result.avoidedZones > 1 ? 's' : ''}</strong></p>
              </div>
              <button
                onClick={clearPath}
                className="mt-3 w-full py-2 text-xs text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
              >
                Effacer le chemin
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}

export function setDestinationFromBuilding(setEndId, building) {
  if (building?.id) setEndId(building.id);
}