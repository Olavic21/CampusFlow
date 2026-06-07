import { memo, useState, Component } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { X, Navigation, BarChart3, MapPin, AlertCircle, Star } from 'lucide-react';
import capteursData from '../data/capteurs.json';
import { getCongestionLevel } from '../utils/congestionColor';
import {
  getBuildingLucideIcon,
  getTypeLabel,
  getBuildingImageUrl,
} from '../utils/buildingVisuals';
import { isValidBuilding, safeOccupancy } from '../utils/buildingSafety';

function getSparklineData(locationId, currentHour) {
  try {
    const hour = Number.isFinite(currentHour) ? currentHour : 9;
    const points = [];
    for (let h = Math.max(0, hour - 6); h <= hour; h++) {
      const snap = capteursData.find(
        (s) => s.location_id === locationId && s.heure === h && s.minute === 0,
      );
      points.push({ hour: `${h}h`, value: snap?.nombre_etudiants ?? 0 });
    }
    return points.length ? points : [{ hour: '—', value: 0 }];
  } catch {
    return [{ hour: '—', value: 0 }];
  }
}

class ChartErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="text-xs text-slate-500 text-center py-6">Graphique indisponible</p>
      );
    }
    return this.props.children;
  }
}

function SafeSparkline({ data, color }) {
  return (
    <ChartErrorBoundary>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.15}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartErrorBoundary>
  );
}

function SheetContent({
  building,
  occupancy,
  currentHour,
  onClose,
  onNavigate,
  onHistory,
  isFavorite,
  onToggleFavorite,
}) {
  const [imgError, setImgError] = useState(false);

  if (!isValidBuilding(building)) {
    return (
      <>
        <motion.div
          className="fixed inset-0 z-[550] bg-slate-900/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.aside
          className="fixed z-[560] cf-glass p-6 max-w-sm inset-x-4 md:right-4 md:left-auto md:top-4 md:bottom-4 rounded-2xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <AlertCircle className="text-amber-500 mb-2" />
          <p className="text-sm font-medium text-slate-800 dark:text-white">
            Données du bâtiment indisponibles
          </p>
          <button type="button" onClick={onClose} className="cf-btn-primary mt-4 w-full">
            Fermer
          </button>
        </motion.aside>
      </>
    );
  }

  const occ = safeOccupancy(occupancy, building);
  const count = occ.count;
  const capacite = building.capacite ?? occ.capacite ?? 0;
  const taux = capacite > 0 ? count / capacite : occ.taux ?? 0;
  const { color, label } = getCongestionLevel(taux);
  const pct = Math.round(taux * 100);
  const sparkline = getSparklineData(building.geoId ?? building.id, currentHour);
  const Icon = getBuildingLucideIcon(building);
  const imageUrl = getBuildingImageUrl(building);

  return (
    <>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-[550] bg-slate-900/40 backdrop-blur-sm md:bg-black/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.aside
        key="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="building-sheet-title"
        className="fixed z-[560] cf-glass overflow-hidden flex flex-col shadow-2xl border border-white/30 dark:border-slate-700/50
          inset-x-0 bottom-0 max-h-[88vh] rounded-t-[24px]
          md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:w-[400px] md:max-h-none md:rounded-l-[24px] md:rounded-tr-none md:rounded-br-none"
        initial={{ y: '100%', x: '100%' }}
        animate={{ y: 0, x: 0 }}
        exit={{ y: '100%', x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        <div className="relative h-40 shrink-0 overflow-hidden group">
          {!imgError ? (
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#2563EB] to-[#1e40af] flex items-center justify-center">
              <Icon size={48} className="text-white/80" strokeWidth={1.5} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/25 to-transparent" />
          <div className="absolute top-3 right-3 flex gap-2">
            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(building)}
                className={`p-2 rounded-full transition ${
                  isFavorite
                    ? 'bg-amber-400/90 text-white'
                    : 'bg-black/30 text-white hover:bg-black/50'
                }`}
                aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Star size={18} strokeWidth={2} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition"
              aria-label="Fermer"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
          <div className="absolute bottom-3 left-4 right-4 flex items-end gap-3">
            <div
              className="p-2.5 rounded-xl backdrop-blur-md border border-white/20"
              style={{ backgroundColor: `${color}cc` }}
            >
              <Icon size={22} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="text-white min-w-0">
              <h2 id="building-sheet-title" className="font-bold text-lg leading-tight truncate">
                {building.nom}
              </h2>
              <p className="text-xs text-white/80 flex items-center gap-1 mt-0.5">
                <MapPin size={12} strokeWidth={2} /> SUP&apos;PTIC · Yaoundé
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 sidebar-scroll">
          <section>
            <p className="cf-menu-label mb-2">Occupation actuelle</p>
            <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, pct)}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {count} / {capacite} étudiants
              <span className="text-slate-500 font-normal ml-2">({pct}%)</span>
            </p>
            <span
              className="inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ backgroundColor: `${color}22`, color }}
            >
              {label}
            </span>
          </section>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="cf-stat-chip p-3">
              <dt className="text-slate-500 text-xs">Capacité</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-100">{capacite}</dd>
            </div>
            <div className="cf-stat-chip p-3">
              <dt className="text-slate-500 text-xs">Catégorie</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                {building.categoryLabel || getTypeLabel(building.type, building)}
              </dd>
            </div>
          </dl>

          {building.description && (
            <section>
              <p className="cf-menu-label mb-2">Description</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {building.description}
              </p>
            </section>
          )}

          {(building.services?.length > 0 || building.equipment?.length > 0) && (
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {building.services?.length > 0 && (
                <div className="cf-stat-chip p-3">
                  <p className="cf-menu-label mb-1.5">Services</p>
                  <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    {building.services.map((s) => (
                      <li key={s}>• {s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {building.equipment?.length > 0 && (
                <div className="cf-stat-chip p-3">
                  <p className="cf-menu-label mb-1.5">Équipements</p>
                  <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    {building.equipment.map((e) => (
                      <li key={e}>• {e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section>
            <p className="cf-menu-label mb-2">Fréquentation (6 h)</p>
            <div className="h-28 cf-stat-chip p-2">
              <SafeSparkline data={sparkline} color={color} />
            </div>
          </section>

          <div className="flex flex-col sm:flex-row gap-2 pt-2 pb-safe">
            <button
              type="button"
              onClick={() => {
                try {
                  onNavigate?.(building);
                } catch (e) {
                  console.error('[CampusFlow] navigate', e);
                }
              }}
              className="cf-btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Navigation size={18} strokeWidth={2} />
              Créer itinéraire
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  onHistory?.(building);
                } catch (e) {
                  console.error('[CampusFlow] history', e);
                }
              }}
              className="cf-btn-secondary flex-1 flex items-center justify-center gap-2"
            >
              <BarChart3 size={18} strokeWidth={2} />
              Voir historique
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

function BuildingSheet(props) {
  const { building } = props;
  return (
    <AnimatePresence mode="wait">
      {building ? <SheetContent {...props} /> : null}
    </AnimatePresence>
  );
}

export default memo(BuildingSheet);
