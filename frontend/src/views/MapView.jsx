// src/views/MapView.jsx
import CampusMap from '../components/CampusMap';
import ItineraryPanel from '../components/ItineraryPanel';

export default function MapView({ currentScreen, setCurrentScreen, selectedSalle, setSelectedSalle }) {
  return (
    <div className="relative flex-1 min-h-0 w-full overflow-hidden">
      <CampusMap currentScreen={currentScreen} selectedSalle={selectedSalle} desktop={false} />

      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Écran 1 : recherche */}
        {currentScreen === 1 && (
          <div className="absolute top-4 left-4 right-4 flex gap-2 pointer-events-auto">
            <button
              onClick={() => setCurrentScreen(2)}
              className="flex-1 flex items-center gap-2 bg-white rounded-2xl shadow-md px-4 py-3 text-sm hover:shadow-lg transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0088fe" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <span className="text-gray-600 font-medium">Chercher</span>
              <span className="ml-auto text-[#0088fe]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
                </svg>
              </span>
            </button>
            <button className="bg-[#0088fe] text-white rounded-2xl shadow-md px-4 py-3 text-sm font-semibold hover:bg-blue-600 transition flex items-center gap-1">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              Filtre
            </button>
          </div>
        )}

        {/* Titre écrans 1 & 2 */}
        {(currentScreen === 1 || currentScreen === 2) && (
          <div className="absolute top-20 left-0 right-0 text-center pointer-events-none">
            <h2 className="text-lg font-bold text-gray-800 bg-white/70 backdrop-blur-sm w-fit mx-auto px-3 py-1 rounded-xl">
              Carte du Campus
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Vue interactive</p>
          </div>
        )}

        {/* Écrans 3 & 4 : itinéraire */}
        {(currentScreen === 3 || currentScreen === 4) && <ItineraryPanel />}

        {/* Flèche navigation */}
        <button
          onClick={() => setCurrentScreen((s) => Math.min(s + 1, 5))}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 rounded-full p-2 shadow-md hover:shadow-lg transition pointer-events-auto"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0088fe" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
