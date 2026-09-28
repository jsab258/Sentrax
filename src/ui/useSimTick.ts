import { useEffect, useReducer } from 'react';

/** Re-renders the component a few times per second, for panels that read the simulation directly. */
export function useSimTick(hz = 4): void {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = window.setInterval(force, 1000 / hz);
    return () => window.clearInterval(id);
  }, [hz]);
}
