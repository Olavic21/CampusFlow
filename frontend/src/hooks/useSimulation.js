import { useState, useEffect, useCallback, useRef } from 'react';

const MIN_HOUR = 7;
const MAX_HOUR = 19;

export function useSimulation() {
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef(null);

  const timeToSlider = hour * 2 + (minute >= 30 ? 1 : 0);
  const sliderMin = MIN_HOUR * 2;
  const sliderMax = MAX_HOUR * 2;

  const setFromSlider = useCallback((val) => {
    setHour(Math.floor(val / 2));
    setMinute(val % 2 === 0 ? 0 : 30);
  }, []);

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  useEffect(() => {
    if (!playing) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setMinute((m) => {
        if (m === 0) return 30;
        setHour((h) => {
          if (h >= MAX_HOUR) {
            setPlaying(false);
            return MAX_HOUR;
          }
          return h + 1;
        });
        return 0;
      });
    }, 800);
    return () => clearInterval(intervalRef.current);
  }, [playing]);

  const formattedTime = `${String(hour).padStart(2, '0')}h${String(minute).padStart(2, '0')}`;

  return {
    hour,
    minute,
    formattedTime,
    playing,
    togglePlay,
    setFromSlider,
    timeToSlider,
    sliderMin,
    sliderMax,
    simulatedTime: { hour, minute },
  };
}
