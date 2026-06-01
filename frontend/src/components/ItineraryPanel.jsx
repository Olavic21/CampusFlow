// src/components/ItineraryPanel.jsx
export default function ItineraryPanel() {
  return (
    <div className="absolute top-4 left-4 right-4 z-[400] bg-white rounded-2xl shadow-xl px-4 py-4 pointer-events-auto">
      <div className="mb-3">
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Point de départ</label>
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0088fe" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          </svg>
          <input type="text" defaultValue="Melen" className="bg-transparent text-sm text-gray-700 font-medium outline-none flex-1"/>
        </div>
      </div>
      <div className="flex justify-center mb-3">
        <div className="w-6 h-6 rounded-full bg-[#0088fe]/10 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0088fe" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7"/>
          </svg>
        </div>
      </div>
      <div className="mb-3">
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Destination</label>
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0088fe" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
          <input type="text" defaultValue="Sup'ptic" className="bg-transparent text-sm text-gray-700 font-medium outline-none flex-1"/>
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mt-1">Cliquez sur un batiment pour avoir plus d'infos</p>
    </div>
  );
}
