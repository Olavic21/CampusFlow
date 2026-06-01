// src/App.jsx
// Layout responsive :
//   Mobile  (< 768px) : design smartphone 430px centré, navbar top + bottom bar
//   Desktop (≥ 768px) : sidebar gauche fixe + carte plein écran droite

import { useState } from 'react';
import MobileLayout  from './layouts/MobileLayout';
import DesktopLayout from './layouts/DesktopLayout';
import { useMediaQuery } from './hooks/useMediaQuery';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState(1);
  const [selectedSalle, setSelectedSalle] = useState(null);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const sharedProps = { currentScreen, setCurrentScreen, selectedSalle, setSelectedSalle };

  return isDesktop
    ? <DesktopLayout {...sharedProps} />
    : <MobileLayout  {...sharedProps} />;
}
