/**
 * Content model. Every user-facing string lives under /src/content so it can be reviewed and translated.
 *
 * A Claim is any statement of fact about Sentrax, its products or the problem space. Claims carry their
 * source and an explicit approval flag. Unapproved claims are listed by the dev-only claims overlay.
 */
export interface Claim {
  /** Stable id, used by the claims overlay and for later translation keys. */
  id: string;
  text: string;
  /** Page the wording or fact comes from. */
  sourceUrl: string;
  /** Set to true only after human sign-off. */
  approved: boolean;
  /** ISO date on which the wording was checked against the live source page. */
  verifiedAt?: string;
  /** Reviewer note: where the text came from, what still needs checking. */
  note?: string;
}

/** Marks content that is intentionally missing and must be filled in before release. */
export const PLACEHOLDER_PREFIX = '[PLACEHOLDER]';

export function isPlaceholder(text: string): boolean {
  return text.startsWith(PLACEHOLDER_PREFIX);
}
