/**
 * Rétrocompatibilité — délègue à SensorDataProvider.
 * L'application consomme toujours useCongestion() sans connaître la source.
 */
import { useSensorData } from './useSensorData';

export function useCongestion() {
  return useSensorData();
}
