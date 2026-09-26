import { useEffect } from 'react';
import type { ModelParts } from './instancing';

/** Disposes model geometries when the owner unmounts. */
export function useDisposeModels(models: Record<string, ModelParts>): void {
  useEffect(
    () => () => {
      for (const parts of Object.values(models)) for (const g of Object.values(parts)) g?.dispose();
    },
    [models],
  );
}
