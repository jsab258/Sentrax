import { useCallback } from 'react';
import { labelBridge } from '../scene/layers/labels';

/** DOM container for in-scene labels; the 3D layers place labels in it every frame. */
export function LabelLayer() {
  const ref = useCallback((el: HTMLDivElement | null) => labelBridge.attach(el), []);
  return <div className="label-layer" ref={ref} aria-hidden="true" data-testid="label-layer" />;
}
