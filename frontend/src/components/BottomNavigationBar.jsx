// src/components/BottomNavigationBar.jsx
export default function BottomNavigationBar({ currentScreen, setCurrentScreen }) {
  if (currentScreen === 5) return null;
  return (
    <nav className="w-full bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.08)] shrink-0">
      <button onClick={() => setCurrentScreen(1)} className={`flex flex-col items-center gap-1 px-6 py-1 rounded-xl transition ${currentScreen === 1 ? 'text-[#0088fe]' : 'text-gray-400'}`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/><path d="M3 12v9h18V12"/>
        </svg>
        <span className="text-[10px] font-medium">Home</span>
      </button>
      <button onClick={() => setCurrentScreen(5)} className={`flex flex-col items-center gap-1 px-6 py-1 rounded-xl transition ${currentScreen === 5 ? 'text-[#0088fe]' : 'text-gray-400'}`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="7" width="18" height="14" rx="1"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
        </svg>
        <span className="text-[10px] font-medium">Bâtiments</span>
      </button>
      <button onClick={() => setCurrentScreen(4)} className={`flex flex-col items-center gap-1 px-6 py-1 rounded-xl transition ${currentScreen === 4 ? 'text-[#0088fe]' : 'text-gray-400'}`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
        <span className="text-[10px] font-medium">Profil</span>
      </button>
    </nav>
  );
}
