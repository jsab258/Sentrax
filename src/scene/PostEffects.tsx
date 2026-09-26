import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { HalfFloatType } from 'three';
import type { TierSettings } from './quality';

/**
 * Post-processing for medium and high tiers: SSAO (N8AO) and AgX tone mapping. The low tier skips the
 * composer and lets the renderer tone map directly. There is no composer bloom: overlays render after the
 * composer (see overlay.tsx) so their colours stay exact, and their glow is drawn in that pass.
 */
export function PostEffects({ settings }: { settings: TierSettings }) {
  const effects = [
    settings.ssao !== 'off' && (
      <N8AO
        key="ao"
        halfRes={settings.ssao === 'half'}
        quality={settings.ssao === 'full' ? 'medium' : 'low'}
        aoRadius={0.9}
        distanceFalloff={0.8}
        intensity={2.2}
        color="#1c1f26"
      />
    ),
    <ToneMapping key="tone" mode={ToneMappingMode.AGX} />,
  ].filter((e): e is React.JSX.Element => Boolean(e));
  return (
    <EffectComposer multisampling={settings.msaa} frameBufferType={HalfFloatType} enableNormalPass={false}>
      {effects}
    </EffectComposer>
  );
}
