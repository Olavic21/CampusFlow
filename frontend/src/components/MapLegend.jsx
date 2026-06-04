export default function MapLegend() {
  const levels = [
    { color: '#22c55e', label: 'Disponible' },
    { color: '#f59e0b', label: 'Modéré' },
    { color: '#ef4444', label: 'Chargé' },
    { color: '#7c3aed', label: 'Saturé' },
  ];

  const types = [
    { icon: '🎓', label: 'Amphi' },
    { icon: '🔬', label: 'Labo' },
    { icon: '📚', label: 'Salle C' },
    { icon: '📋', label: 'Salle L' },
    { icon: '🏢', label: 'Admin' },
  ];

  return (
    <div className="absolute bottom-8 left-3 z-[400] bg-white/90 backdrop-blur rounded-xl shadow-md p-3 text-xs pointer-events-none">
      <p className="font-semibold text-slate-600 mb-2">Congestion</p>
      <div className="space-y-1 mb-3">
        {levels.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
            <span className="text-slate-600">{label}</span>
          </div>
        ))}
      </div>
      <p className="font-semibold text-slate-600 mb-1">Types</p>
      <div className="space-y-1">
        {types.map(({ icon, label }) => (
          <div key={label} className="flex items-center gap-2 text-slate-600">
            <span>{icon}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
