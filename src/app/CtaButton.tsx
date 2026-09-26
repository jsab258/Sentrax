import { links } from '../content/links';
import { ui } from '../content/ui';
import { track } from '../analytics/track';
import { postToParent } from '../embed/bridge';

interface Props {
  placement: string;
  variant?: 'primary' | 'secondary';
}

/** The single conversion action. Always a real link with target=_blank, never top-level navigation. */
export function BookMeetingButton({ placement, variant = 'primary' }: Props) {
  return (
    <a
      className={`btn btn-${variant}`}
      href={links.bookMeeting}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        track('cta_clicked', { cta: 'book_meeting', placement });
        postToParent('cta_click', { cta: 'book_meeting', placement });
      }}
    >
      {ui.cta.bookMeeting}
      <span className="visually-hidden"> ({ui.cta.newTabHint})</span>
    </a>
  );
}
