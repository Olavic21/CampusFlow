/**
 * Rétrocompatibilité — délègue à SensorDataProvider.
 * L'application consomme toujours useCongestion() sans connaître la source.
 */
import { useSensorData } from '../context/SensorDataContext';

export function useCongestion() {
  return useSensorData();
}
