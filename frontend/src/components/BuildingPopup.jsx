import { motion } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import capteursData from '../data/capteurs.json';
import { getCongestionLevel, getTypeLabel, getBuildingIcon } from '../utils/congestionColor';

function getSparklineData(locationId, currentHour) {
  const points = [];
  for (let h = Math.max(0, currentHour - 6); h <= currentHour; h++) {
    const snap = capteursData.find(
      (s) => s.location_id === locationId && s.heure === h && s.minute === 0
    );
    points.push({ hour: `${h}h`, value: snap?.nombre_etudiants ?? 0 });
  }
  return points;
}

function getPeakLow(locationId, capacite) {
  const dayData = capteursData.filter((s) => s.location_id === locationId && s.heure >= 7 && s.heure <= 19);
  if (!dayData.length) return { peak: '—', low: '—' };
  const peak = dayData.reduce((a, b) => (a.nombre_etudiants > b.nombre_etudiants ? a : b));
  const low = dayData.reduce((a, b) => (a.nombre_etudiants < b.nombre_etudiants ? a : b));
  return {
    peak: `${String(peak.heure).padStart(2, '0')}h00 (${peak.nombre_etudiants} étudiants)`,
    low: `${String(low.heure).padStart(2, '0')}h${String(low.minute).padStart(2, '0')} (${low.nombre_etudiants} étudiants)`,
  };
}

export default function BuildingPopup({
  building,
  occupancy,
  currentHour = 9,
  onNavigate,
  onHistory,
}) {
  const { count = 0, taux = 0 } = occupancy[building.id] || {};
  const { color, label } = getCongestionLevel(taux);
  const pct = Math.round(taux * 100);
  const sparkline = getSparklineData(building.id, currentHour);
  const { peak, low } = getPeakLow(building.id, building.capacite);
  const icon = getBuildingIcon(building);

  const statusEmoji = taux > 0.9 ? '🔴' : taux > 0.4 ? '🟡' : '🟢';

  return (
    <div className="w-72 p-4 font-sans">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <h3 className="font-bold text-slate-900 text-sm leading-tight">{building.nom}</h3>
      </div>
      <hr className="border-slate-200 mb-3" />

      <div className="flex justify-between text-xs text-slate-500 mb-3">
        <span>Type : <strong className="text-slate-700">{getTypeLabel(building.type)}</strong></span>
        <span>Capacité : <strong className="text-slate-700">{building.capacite}</strong></span>
      </div>

      <div className="mb-3">
        <p className="text-xs text-slate-500 mb-1">Occupation actuelle</p>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
          <motion.div
            className="h-full rounded-full origin-left"
            style={{ backgroundColor: color }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: Math.min(1, taux) }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <p className="text-xs font-semibold text-slate-700">
          {count} / {building.capacite} ({pct}%) {statusEmoji} {label}
        </p>
      </div>

      <div className="mb-3">
        <p className="text-xs text-slate-500 mb-1">Évolution sur 6h</p>
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline}>
              <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.2} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="text-xs text-slate-500 space-y-1 mb-4">
        <p>Pic journalier : <span className="text-slate-700">{peak}</span></p>
        <p>Heure creuse : <span className="text-slate-700">{low}</span></p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onNavigate?.(building)}
          className="flex-1 text-xs py-2 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          📍 Aller ici
        </button>
        <button
          onClick={() => onHistory?.(building)}
          className="flex-1 text-xs py-2 px-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium"
        >
          📊 Historique
        </button>
      </div>
    </div>
  );
}
