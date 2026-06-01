// src/layouts/MobileLayout.jsx
// Design mobile inchangé — smartphone 430px centré

import Navbar from '../components/Navbar';
import BottomNavigationBar from '../components/BottomNavigationBar';
import MapView from '../views/MapView';
import BuildingList from '../views/BuildingList';

function getNavbarView(screen) {
  if (screen === 5) return 'back';
  if (screen >= 3) return 'profile';
  return 'default';
}

export default function MobileLayout({ currentScreen, setCurrentScreen, selectedSalle, setSelectedSalle }) {
  return (
    <div
      className="flex justify-center items-start overflow-hidden bg-gray-900"
      style={{ height: '100dvh' }}
    >
      <div
        className="relative w-full max-w-[430px] flex flex-col bg-white overflow-hidden shadow-2xl"
        style={{ height: '100dvh' }}
      >
        {/* Navbar */}
        <div className="shrink-0 z-50">
          <Navbar
            view={getNavbarView(currentScreen)}
            onBack={() => setCurrentScreen(1)}
          />
        </div>

        {/* Contenu */}
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">
          {currentScreen <= 4 ? (
            <MapView
              currentScreen={currentScreen}
              setCurrentScreen={setCurrentScreen}
              selectedSalle={selectedSalle}
              setSelectedSalle={setSelectedSalle}
            />
          ) : (
            <BuildingList />
          )}
        </main>

        {/* Bottom bar */}
        <div className="shrink-0">
          <BottomNavigationBar
            currentScreen={currentScreen}
            setCurrentScreen={setCurrentScreen}
          />
        </div>
      </div>
    </div>
  );
}
