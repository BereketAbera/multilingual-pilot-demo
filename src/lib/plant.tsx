import { createContext, useContext, type ReactNode } from 'react';
import type { Plant } from './api';
import { useApi } from './useApi';

type PlantInfo = Plant & { today: string };

const PlantContext = createContext<PlantInfo | null>(null);

/** Plant settings: name, time zone and units. Units belong to the plant, not to the language. */
export function PlantProvider({ children }: { children: ReactNode }) {
  const { data } = useApi<PlantInfo>('/api/plant');
  return <PlantContext.Provider value={data}>{children}</PlantContext.Provider>;
}

export function usePlant(): PlantInfo | null {
  return useContext(PlantContext);
}
