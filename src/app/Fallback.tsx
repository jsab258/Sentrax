import { ui } from '../content/ui';
import { BookMeetingButton } from './CtaButton';

/** Shown when WebGL2 is unavailable: poster, short text and the CTA. */
export function Fallback() {
  return (
    <main className="fallback" data-testid="webgl-fallback">
      <img className="fallback-poster" src="./poster.svg" alt="" width={960} height={540} />
      <div className="fallback-body">
        <h1>{ui.fallback.title}</h1>
        <p>{ui.fallback.body}</p>
        <BookMeetingButton placement="webgl_fallback" />
      </div>
    </main>
  );
}
