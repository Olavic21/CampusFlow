import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from './ThemeToggle';

export default function ControlPanel({
  buildings,
  filters,
  setFilters,
  simulation,
  globalStats,
  onSearchSelect,
  onStatsOpen,
  onExport,
  onCompare,
  compareSelection,
  darkMode,
  setDarkMode,
}) {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  const suggestions = query.length >= 1
    ? buildings.filter((b) => b.nom.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];

  useEffect(() => {
    const handler = (e) => {
      if (!inputRef.current?.contains(e.target)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleType = (type) => {
    setFilters((f) => ({
      ...f,
      types: f.types.includes(type)
        ? f.types.filter((t) => t !== type)
        : [...f.types, type],
    }));
  };

  return (
    <div className="absolute top-3 left-3 right-3 z-[500] flex flex-wrap gap-2 pointer-events-none">
      <div className="flex flex-wrap gap-2 pointer-events-auto flex-1">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs" ref={inputRef}>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="🔍 Rechercher un bâtiment…"
            className="w-full text-sm bg-white/95 backdrop-blur rounded-xl px-4 py-2.5 shadow-md border border-slate-200 outline-none focus:ring-2 focus:ring-blue-400"
          />
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-full mt-1 w-full bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-10"
              >
                {suggestions.map((b) => (
                  <li key={b.id}>
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition"
                      onClick={() => {
                        onSearchSelect(b);
                        setQuery(b.nom);
                        setShowSuggestions(false);
                      }}
                    >
                      {b.nom}
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        {/* Filters dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="text-sm bg-white/95 backdrop-blur rounded-xl px-4 py-2.5 shadow-md border border-slate-200 font-medium hover:bg-slate-50 transition"
          >
            Filtres ▾
          </button>
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-full mt-1 right-0 w-56 bg-white rounded-xl shadow-xl border border-slate-100 p-3 z-10"
              >
                <p className="text-xs font-semibold text-slate-500 mb-2">Type</p>
                {[
                  { key: 'amphi', label: 'Amphi' },
                  { key: 'labo', label: 'Labo' },
                  { key: 'salle', label: 'Salle' },
                  { key: 'admin', label: 'Admin' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.types.includes(key)}
                      onChange={() => toggleType(key)}
                    />
                    {label}
                  </label>
                ))}
                <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Congestion</p>
                <select
                  value={filters.congestion}
                  onChange={(e) => setFilters((f) => ({ ...f, congestion: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                >
                  <option value="all">Tous</option>
                  <option value="disponible">Disponibles</option>
                  <option value="charge">Chargés</option>
                  <option value="sature">Saturés</option>
                </select>
                <label className="flex items-center gap-2 text-sm py-2 mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.heatmapOnly}
                    onChange={(e) => setFilters((f) => ({ ...f, heatmapOnly: e.target.checked }))}
                  />
                  Mode heatmap
                </label>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Simulation */}
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur rounded-xl px-3 py-2 shadow-md border border-slate-200">
          <span className="text-sm whitespace-nowrap">🕐 {simulation.formattedTime}</span>
          <input
            type="range"
            min={simulation.sliderMin}
            max={simulation.sliderMax}
            value={simulation.timeToSlider}
            onChange={(e) => simulation.setFromSlider(Number(e.target.value))}
            className="w-24 accent-blue-600"
          />
          <button
            onClick={simulation.togglePlay}
            className="text-lg leading-none hover:scale-110 transition"
            aria-label={simulation.playing ? 'Pause' : 'Lecture'}
          >
            {simulation.playing ? '⏸' : '▶️'}
          </button>
        </div>

        <button
          onClick={onStatsOpen}
          className="text-sm bg-white/95 backdrop-blur rounded-xl px-4 py-2.5 shadow-md border border-slate-200 font-medium hover:bg-slate-50 transition"
        >
          📊 Stats
        </button>

        <button
          onClick={onExport}
          className="text-sm bg-white/95 backdrop-blur rounded-xl px-3 py-2.5 shadow-md border border-slate-200 hover:bg-slate-50 transition hidden sm:block"
          title="Exporter la vue"
        >
          📸
        </button>

        <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>

      {/* Stats modal trigger handled by parent */}
    </div>
  );
}

export function StatsModal({ globalStats, occupancy, onClose }) {
  const pct = Math.round(globalStats.occupancyRate * 100);
  const maxPct = globalStats.maxBuilding
    ? Math.round((occupancy[globalStats.maxBuilding.id]?.taux ?? 0) * 100)
    : 0;
  const minPct = globalStats.minBuilding
    ? Math.round((occupancy[globalStats.minBuilding.id]?.taux ?? 0) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-lg mb-4">📊 Stats globales</h3>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-slate-500 mb-1">Occupation campus : {pct}%</p>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <p>Bâtiment le plus chargé : <strong>{globalStats.maxBuilding?.nom}</strong> ({maxPct}%)</p>
          <p>Bâtiment le plus libre : <strong>{globalStats.minBuilding?.nom}</strong> ({minPct}%)</p>
          <p>Salles disponibles : <strong>{globalStats.availableRooms} / {globalStats.totalRooms}</strong></p>
        </div>
        <button onClick={onClose} className="mt-4 w-full py-2 bg-slate-100 rounded-xl text-sm font-medium hover:bg-slate-200">
          Fermer
        </button>
      </motion.div>
    </motion.div>
  );
}

export function CompareModal({ buildings, selection, occupancy, onClose }) {
  const selected = buildings.filter((b) => selection.includes(b.id));
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-4">Comparaison de salles</h3>
        <div className="space-y-2">
          {selected.map((b) => {
            const o = occupancy[b.id] || { count: 0, taux: 0 };
            return (
              <div key={b.id} className="flex justify-between text-sm border-b pb-2">
                <span>{b.nom}</span>
                <span>{o.count}/{b.capacite} ({Math.round(o.taux * 100)}%)</span>
              </div>
            );
          })}
        </div>
        <button onClick={onClose} className="mt-4 w-full py-2 bg-slate-100 rounded-xl text-sm">Fermer</button>
      </div>
    </motion.div>
  );
}

export function ToastAlert({ message, onClose }) {
  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      className="fixed top-4 right-4 z-[700] bg-red-600 text-white rounded-xl px-4 py-3 shadow-xl max-w-xs flex items-start gap-2"
    >
      <span className="text-sm flex-1">{message}</span>
      <button onClick={onClose} className="text-white/80 hover:text-white text-lg leading-none">×</button>
    </motion.div>
  );
}
