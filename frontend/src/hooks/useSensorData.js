import { useContext } from 'react';
import SensorDataContext from '../context/SensorDataContext';

export function useSensorData() {
  const ctx = useContext(SensorDataContext);
  if (!ctx) throw new Error('useSensorData must be used within SensorDataProvider');
  return ctx;
}
