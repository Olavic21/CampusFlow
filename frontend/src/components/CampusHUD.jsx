export default function CampusHUD({ globalStats, formattedTime, offline }) {
  const dateStr = 'Lundi 07/10/2024';

  return (
    <div className="absolute bottom-3 right-3 z-[400] bg-white/90 backdrop-blur rounded-xl shadow-md px-4 py-3 text-xs space-y-1 max-w-[260px]">
      {offline && (
        <span className="inline-block bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1">
          Mode hors ligne
        </span>
      )}
      <p className="font-semibold text-slate-700">🕐 {dateStr} — {formattedTime}</p>
      <p className="text-slate-500">🎓 Campus SUP&apos;PTIC — Yaoundé</p>
      <p className="text-slate-700">👥 Occupation globale : <strong>{globalStats.totalStudents}</strong> étudiants</p>
      <p className="text-slate-600">
        🔴 {globalStats.sature} saturées | 🟡 {globalStats.modere} modérées | 🟢 {globalStats.disponible} disponibles
      </p>
    </div>
  );
}
