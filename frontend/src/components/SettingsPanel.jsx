import { memo } from 'react';
import { Moon, Sun, Download, Filter, Wifi, WifiOff } from 'lucide-react';

function SettingsPanel({
  darkMode,
  onToggleTheme,
  offline,
  filters,
  setFilters,
  onExport,
}) {
  const toggleType = (type) => {
    setFilters((f) => ({
      ...f,
      types: f.types.includes(type)
        ? f.types.filter((t) => t !== type)
        : [...f.types, type],
    }));
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 sidebar-scroll bg-slate-50 dark:bg-slate-950">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Paramètres</h1>

      <section className="cf-glass rounded-[20px] p-4 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
          Apparence
        </h2>
        <button
          type="button"
          onClick={onToggleTheme}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            {darkMode ? <Moon size={18} /> : <Sun size={18} />}
            {darkMode ? 'Mode sombre' : 'Mode clair'}
          </span>
          <span className="text-xs text-slate-500">Changer</span>
        </button>
      </section>

      <section className="cf-glass rounded-[20px] p-4 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
          {offline ? <WifiOff size={16} className="text-amber-500" /> : <Wifi size={16} className="text-emerald-500" />}
          Connexion
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {offline
            ? 'Mode hors ligne — données locales actives'
            : 'Connecté à l’API CampusFlow'}
        </p>
      </section>

      <section className="cf-glass rounded-[20px] p-4 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
          <Filter size={16} />
          Filtres carte
        </h2>
        <div className="space-y-2">
          {[
            { key: 'amphi', label: 'Amphithéâtres' },
            { key: 'labo', label: 'Laboratoires' },
            { key: 'salle', label: 'Salles' },
            { key: 'admin', label: 'Administration' },
            { key: 'dortoir', label: 'Dortoirs' },
            { key: 'service', label: 'Services' },
            { key: 'sport', label: 'Sport' },
          ].map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-2 text-sm cursor-pointer py-1"
            >
              <input
                type="checkbox"
                checked={filters.types.includes(key)}
                onChange={() => toggleType(key)}
                className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
              />
              {label}
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-700">
          <input
            type="checkbox"
            checked={filters.heatmapOnly}
            onChange={(e) => setFilters((f) => ({ ...f, heatmapOnly: e.target.checked }))}
          />
          Mode heatmap uniquement
        </label>
      </section>

      <section className="cf-glass rounded-[20px] p-4">
        <button
          type="button"
          onClick={onExport}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#2563EB] text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition"
        >
          <Download size={18} />
          Exporter la carte (PNG)
        </button>
      </section>
    </div>
  );
}

export default memo(SettingsPanel);
