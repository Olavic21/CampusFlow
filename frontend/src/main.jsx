import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import 'leaflet/dist/leaflet.css';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import { initCapacitor } from './utils/capacitor';
import { seedOfflineData } from './services/offlineStorage';

seedOfflineData().catch(() => {});
initCapacitor().catch(() => {});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {/* reducedMotion="user" respecte prefers-reduced-motion (audit P1 a11y) */}
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <App />
        </AuthProvider>
      </MotionConfig>
    </ErrorBoundary>
  </StrictMode>,
);
