/**
 * Pluggable analytics. No third-party scripts and no cookies: the default sink logs to the console.
 * The host page (or a later build) can install its own sink with setAnalyticsSink.
 */
export type AnalyticsEvent =
  | 'scene_opened'
  | 'story_started'
  | 'story_step'
  | 'story_completed'
  | 'sandbox_opened'
  | 'device_inspected'
  | 'lens_changed'
  | 'cta_clicked'
  // Homepage scroll story (SCROLL-SPEC.md section 8).
  | 'scroll_story_view'
  | 'scroll_beat'
  | 'find_tapped'
  | 'find_auto'
  | 'fallback_used';

export type AnalyticsProps = Record<string, string | number | boolean | undefined>;
export type AnalyticsSink = (event: AnalyticsEvent, props: AnalyticsProps) => void;

const consoleSink: AnalyticsSink = (event, props) => {
  console.info('[track]', event, props);
};

let sink: AnalyticsSink = consoleSink;

export function setAnalyticsSink(next: AnalyticsSink | null): void {
  sink = next ?? consoleSink;
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  try {
    sink(event, props);
  } catch {
    // Analytics must never break the demo.
  }
}
