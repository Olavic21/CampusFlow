import { useMemo, useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import CampusLayoutEngine from '../../engine/CampusLayoutEngine';

function groupByCategory(options) {
  const groups = new Map();
  for (const opt of options) {
    const key = opt.category || 'other';
    if (!groups.has(key)) {
      groups.set(key, { id: key, label: opt.categoryLabel || key, items: [] });
    }
    groups.get(key).items.push(opt);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

export default function RouteBuildingPicker({
  id,
  label,
  value,
  twinId,
  geoBuildings = [],
  occupancy = {},
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);

  const options = useMemo(
    () => CampusLayoutEngine.getRouteBuildings(occupancy, geoBuildings),
    [geoBuildings, occupancy],
  );

  const selected = useMemo(() => {
    if (twinId) return options.find((o) => o.id === twinId) ?? null;
    if (value == null) return null;
    return (
      options.find((o) => o.routeId === value && o.routeExact) ||
      options.find((o) => o.routeId === value) ||
      null
    );
  }, [options, value, twinId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.code?.toLowerCase().includes(q) ||
        o.nom?.toLowerCase().includes(q) ||
        o.categoryLabel?.toLowerCase().includes(q),
    );
  }, [options, query]);

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  useEffect(() => {
    const handler = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePick = (opt) => {
    onChange?.(opt.routeId, opt.id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={id} className="cf-menu-label">
        {label}
      </label>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="cf-menu-input mt-1 w-full flex items-center justify-between gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">
          {selected ? (
            <>
              <span className="font-semibold">{selected.code || selected.nom}</span>
              {selected.code && selected.nom !== selected.code && (
                <span className="text-slate-400 ml-1 text-xs">— {selected.nom}</span>
              )}
            </>
          ) : (
            <span className="text-slate-400">— Choisir —</span>
          )}
        </span>
        <ChevronDown size={14} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 top-full mt-1 w-full cf-glass rounded-xl shadow-xl border border-white/30 dark:border-slate-600/50 overflow-hidden">
          <div className="p-2 border-b border-slate-200/50 dark:border-slate-700/50">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="C1, Dortoir, Restaurant…"
                className="w-full text-xs cf-menu-input pl-8 py-2"
                autoFocus
              />
            </div>
          </div>
          <ul
            className="max-h-52 overflow-y-auto sidebar-scroll py-1"
            role="listbox"
            aria-label={label}
          >
            {groups.length === 0 && (
              <li className="px-3 py-2 text-xs text-slate-400">Aucun résultat</li>
            )}
            {groups.map((group) => (
              <li key={group.id}>
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {group.label}
                </p>
                {group.items.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={selected?.id === opt.id}
                    onClick={() => handlePick(opt)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-slate-800 transition
                      ${selected?.id === opt.id ? 'bg-blue-50/80 dark:bg-slate-800/80 font-semibold' : ''}`}
                  >
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {opt.code || opt.nom}
                    </span>
                    {opt.code && opt.nom !== opt.code && (
                      <span className="text-slate-500 ml-1">{opt.nom}</span>
                    )}
                  </button>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
