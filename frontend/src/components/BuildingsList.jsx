import { useState, useMemo, useRef, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Building2, Users, ChevronDown, DoorOpen } from 'lucide-react';
import { getCongestionLevel, TWIN_DEMO } from '../utils/congestionColor';
import { fetchFreeLocations } from '../services/api';
import {
  getBuildingLucideIcon,
  getBuildingImageUrl,
} from '../utils/buildingVisuals';
import CampusLayoutEngine from '../engine/CampusLayoutEngine';

/** Bandeau « Libres maintenant » (Phase 3) — bâtiments < 40 % sur 5 min. */
function FreeNowStrip({ buildings, onSelect }) {
  const [rooms, setRooms] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchFreeLocations(6);
        if (!cancelled) setRooms(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setRooms([]);
      }
    };
    load();
    const t = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!rooms?.length) return null;

  return (
    <section className="cf-menu-card p-3 mb-5" aria-label="Salles libres maintenant">
      <p className="cf-menu-label mb-2 flex items-center gap-1.5">
        <DoorOpen size={14} className="text-emerald-600" />
        Libres maintenant
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          capteur · 5 min
        </span>
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {rooms.map((r) => {
          const geoB = buildings.find((b) => b.id === r.id);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => geoB && onSelect?.(geoB)}
              className="shrink-0 text-left px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900 hover:border-emerald-400 transition"
            >
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {r.nom}
              </p>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400">
                {r.count}/{r.capacite} · {Math.round(r.occupancy_rate * 100)}%
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BuildingCard({ building, onSelect, onRouteFrom }) {
  const isDemo = !!building.simulated;
  const taux = building.taux ?? building.occupancy?.taux ?? 0;
  const count = building.count ?? building.occupancy?.count ?? 0;
  const { color, label } = isDemo
    ? { color: TWIN_DEMO.color, label: 'Démo' }
    : getCongestionLevel(taux);
  const Icon = getBuildingLucideIcon(building);
  const imageUrl = getBuildingImageUrl(building);
  const clickTimer = useRef(null);

  const handleClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      onRouteFrom?.(building);
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      onSelect?.(building);
    }, 250);
  };

  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <button
        type="button"
        onClick={handleClick}
        className="w-full cf-menu-card overflow-hidden text-left group focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50"
      >
        <div className="relative h-20 overflow-hidden">
          <img src={imageUrl} alt="" className="w-full h-full object-cover opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
          <div
            className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {label}
          </div>
          <div className="absolute bottom-2 left-2 flex items-center gap-2">
            <div className="p-1.5 rounded-lg backdrop-blur-md" style={{ backgroundColor: `${color}cc` }}>
              <Icon size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{building.code || building.nom}</p>
              {building.categoryLabel && (
                <p className="text-[10px] text-white/70">{building.categoryLabel}</p>
              )}
            </div>
          </div>
        </div>
        <div className="px-3 py-2 flex justify-between text-xs text-slate-500">
          {isDemo ? (
            <span className="italic">Pas de capteur — valeur indicative</span>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <Users size={12} />
                {count}/{building.capacite}
              </span>
              <span>{Math.round(taux * 100)}%</span>
            </>
          )}
        </div>
      </button>
    </motion.li>
  );
}

function CategorySection({ category, buildings, onSelect, onRouteFrom, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!buildings.length) return null;
  return (
    <section className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-2 px-1 text-sm font-bold text-slate-800 dark:text-white"
      >
        <span className="flex items-center gap-2">
          <Building2 size={16} className="text-[#2563EB]" />
          {category.label}
          <span className="text-xs font-normal text-slate-400">({buildings.length})</span>
        </span>
        <ChevronDown size={16} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-hidden"
          >
            {buildings.map((b) => (
              <BuildingCard
                key={b.id}
                building={b}
                onSelect={onSelect}
                onRouteFrom={onRouteFrom}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}

function BuildingsList({ buildings, occupancy, onSelect, onRouteFrom }) {
  const [query, setQuery] = useState('');

  const twinBuildings = useMemo(
    () => CampusLayoutEngine.enrichAll(occupancy, buildings),
    [occupancy, buildings],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return twinBuildings;
    return CampusLayoutEngine.search(query).map((t) =>
      CampusLayoutEngine.enrichBuilding(t, occupancy, buildings),
    );
  }, [query, twinBuildings, occupancy, buildings]);

  const categories = useMemo(() => {
    if (query.trim()) {
      return [{ id: 'results', label: 'Résultats', buildings: filtered }];
    }
    return CampusLayoutEngine.getCategories().map((cat) => ({
      ...cat,
      buildings: cat.buildings.map((t) =>
        CampusLayoutEngine.enrichBuilding(t, occupancy, buildings),
      ),
    }));
  }, [query, filtered, occupancy, buildings]);

  return (
    <div className="flex-1 overflow-y-auto sidebar-scroll p-4 md:p-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Bâtiments</h1>
        <p className="text-sm text-slate-500 mt-1">Plan officiel SUP&apos;PTIC — Digital Twin</p>
      </header>

      <FreeNowStrip buildings={buildings} onSelect={onSelect} />

      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="C1, L31, Bloc Admin, Restaurant…"
          className="w-full cf-menu-input pl-9 py-2.5"
        />
      </div>

      {categories.map((cat, i) => (
        <CategorySection
          key={cat.id}
          category={cat}
          buildings={cat.buildings}
          onSelect={onSelect}
          onRouteFrom={onRouteFrom}
          defaultOpen={i < 2 || !!query.trim()}
        />
      ))}
    </div>
  );
}

export default memo(BuildingsList);
