import { useState, useMemo, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { Search, Building2, Users } from 'lucide-react';
import { getCongestionLevel } from '../utils/congestionColor';
import {
  getBuildingLucideIcon,
  getTypeLabel,
  getBuildingImageUrl,
} from '../utils/buildingVisuals';

function BuildingCard({ building, occupancy, onSelect, onRouteFrom }) {
  const occ = occupancy[building.id] || { count: 0, taux: 0 };
  const { color, label } = getCongestionLevel(occ.taux);
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
      onSelect(building);
    }, 250);
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <button
        type="button"
        onClick={handleClick}
        className="w-full cf-menu-card overflow-hidden text-left group focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50"
      >
        <div className="relative h-24 overflow-hidden">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent" />
          <div
            className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {label}
          </div>
          <div
            className="absolute bottom-2 left-2 p-1.5 rounded-lg backdrop-blur-md"
            style={{ backgroundColor: `${color}cc` }}
          >
            <Icon size={16} className="text-white" strokeWidth={2.5} />
          </div>
        </div>
        <div className="p-3">
          <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
            {building.nom}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{getTypeLabel(building.type, building)}</p>
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="flex items-center gap-1 text-slate-500">
              <Users size={12} strokeWidth={2} />
              {occ.count}/{building.capacite}
            </span>
            <span className="font-bold tabular-nums" style={{ color }}>
              {Math.round(occ.taux * 100)}%
            </span>
          </div>
          <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, occ.taux * 100)}%`, backgroundColor: color }}
            />
          </div>
        </div>
      </button>
    </motion.li>
  );
}

function BuildingsList({ buildings, occupancy, onSelect, onRouteFrom }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...buildings].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    if (!q) return list;
    return list.filter(
      (b) =>
        b.nom.toLowerCase().includes(q) ||
        getTypeLabel(b.type, b).toLowerCase().includes(q),
    );
  }, [buildings, query]);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      <header className="p-4 border-b border-slate-200/80 dark:border-slate-800 shrink-0 cf-glass !rounded-none">
        <div className="flex items-center gap-2 mb-3">
          <Building2 size={22} className="text-[#2563EB]" strokeWidth={2} />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Tous les bâtiments
          </h1>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Clic : fiche · Double-clic : itinéraire rapide
        </p>
        <div className="relative">
          <Search
            size={18}
            strokeWidth={2}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un bâtiment…"
            className="cf-menu-input w-full pl-10"
          />
        </div>
      </header>
      <ul className="flex-1 overflow-y-auto p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sidebar-scroll content-start">
        {filtered.map((b) => (
          <BuildingCard
            key={b.id}
            building={b}
            occupancy={occupancy}
            onSelect={onSelect}
            onRouteFrom={onRouteFrom}
          />
        ))}
      </ul>
      {filtered.length === 0 && (
        <p className="p-8 text-center text-sm text-slate-500">Aucun bâtiment trouvé</p>
      )}
    </div>
  );
}

export default memo(BuildingsList);
