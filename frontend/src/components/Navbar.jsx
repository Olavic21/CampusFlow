// src/components/Navbar.jsx
export default function Navbar({ view = 'default', onBack }) {
  return (
    <header className="w-full bg-[#0088fe] px-4 py-3 flex items-center justify-between shadow-md z-50">
      <div className="flex items-center gap-2">
        {view === 'back' ? (
          <button onClick={onBack} className="text-white p-1 rounded-full hover:bg-white/20 transition">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M3 12L12 3l9 9" stroke="#0088fe" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 21V12h6v9" stroke="#0088fe" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">CampusFlow</p>
              <p className="text-blue-100 text-[10px] leading-tight">Optimisation des flux étudiants</p>
            </div>
          </div>
        )}
      </div>
      {view === 'back' && <span className="text-white font-semibold text-base">Batiments disponibles</span>}
      {(view === 'profile' || view === 'back') && (
        <button className="text-white p-1 rounded-full hover:bg-white/20 transition">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </button>
      )}
      {view === 'default' && <div className="w-7"/>}
    </header>
  );
}
