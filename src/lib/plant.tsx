import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Plant } from './api';
import { useApi } from './useApi';

export type PlantInfo = Plant & { today: string };

interface PlantState {
  plant: PlantInfo | null;
  /** Set when the plant settings could not be loaded; a screen that needs them shows it and offers a retry. */
  error: unknown;
  reload: () => void;
}

const PlantContext = createContext<PlantState>({ plant: null, error: null, reload: () => undefined });

/** Plant settings: name, time zone, units and the plant's own "today". Units belong to the plant, not to the language. */
export function PlantProvider({ children }: { children: ReactNode }) {
  const { data, error, reload } = useApi<PlantInfo>('/api/plant');
  const state = useMemo(() => ({ plant: data, error, reload }), [data, error, reload]);
  return <PlantContext.Provider value={state}>{children}</PlantContext.Provider>;
}

export function usePlant(): PlantInfo | null {
  return useContext(PlantContext).plant;
}

export function usePlantState(): PlantState {
  return useContext(PlantContext);
}
