/**
 * Theory of change on an activity — Input, Output, Outcome, Learnings — added
 * 28 Sep 2026 on the owner's call and shown on the public activity page.
 * Pure helpers only, so they can be tested without a build.
 */

/** Strapi's `evidence_type` values, exactly as stored. */
export const EVIDENCE_TYPES = ['Observed', 'Participants told us', 'Measured'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

/** The ui-string key for each evidence type — the reader-facing wording lives in the CMS. */
export const EVIDENCE_KEY: Record<EvidenceType, string> = {
  Observed: 'toc.evidence_observed',
  'Participants told us': 'toc.evidence_told',
  Measured: 'toc.evidence_measured',
};

export interface ActivityToc {
  materials: string | null;
  outsideHelp: string | null;
  /** Hours the session ran. null = not recorded. */
  hours: number | null;
  /** Rupees spent. null = not recorded; a recorded 0 stays 0. */
  costInr: number | null;
  /** What was made: `quantity` null when the story gives no number. */
  made: { item: string; quantity: number | null }[];
  /** Outcome names from the club's list, in the club's order. */
  outcomes: string[];
  evidence: string | null;
  evidenceType: EvidenceType | null;
  learnings: string | null;
}

/**
 * How long, as a ui-string key and its number: under an hour reads in minutes
 * (0.75 -> "45 minutes"), exactly one hour in the singular, anything else in
 * hours (1.5 -> "1.5 hours"). null when not recorded or not a positive number.
 */
export function durationParts(hours: number | null): { key: string; n: number } | null {
  if (hours === null || !Number.isFinite(hours) || hours <= 0) return null;
  // ⛔ Round FIRST, then choose the wording from the rounded value — choosing
  // first gave "1 hours" for 1.004 and "0 minutes" for 0.004.
  const minutes = Math.round(hours * 60);
  if (minutes === 0) return null;
  if (minutes < 60) return { key: 'toc.minutes', n: minutes };
  const rounded = Math.round(hours * 100) / 100;
  if (rounded === 1) return { key: 'toc.hour', n: 1 };
  return { key: 'toc.hours', n: rounded };
}

/** The site's one number format — the same rule as ActivityCounts and SpaceCounts. */
export function numberFormat(locale: string): Intl.NumberFormat {
  return new Intl.NumberFormat(locale === 'ml' ? 'ml-IN' : 'en-IN');
}

/** ₹ with Indian digit grouping: 125000 -> "₹1,25,000". */
export function formatInr(amount: number, locale: string = 'en'): string {
  return `₹${numberFormat(locale).format(amount)}`;
}

/** Paragraphs from a plain-text field: one per line, blank lines dropped. Page and report share it. */
export function paragraphsOf(text: string | null): string[] {
  return (text ?? '').split(/\n+/).map((p) => p.trim()).filter(Boolean);
}

/** One "what was made" line as a reader sees it: "10 Paper circuits", or just the item. */
export function madeLine(m: { item: string; quantity: number | null }, nf: Intl.NumberFormat): string {
  return m.quantity !== null ? `${nf.format(m.quantity)} ${m.item}` : m.item;
}

/**
 * Where a part renders — the owner's three groups (29 Sep 2026): Input, then the
 * Activity (the write-up) with its Output, then Outcome with Learnings.
 */
export type TocPlace = 'input' | 'output' | 'results' | 'all';

/**
 * Which parts have anything to show, in one place on the page. A part with
 * nothing renders nothing; `place` keeps only the parts that belong there.
 */
export function tocParts(toc: ActivityToc, place: TocPlace = 'all') {
  const has = {
    input: !!(toc.materials || toc.outsideHelp || durationParts(toc.hours) || toc.costInr !== null),
    output: toc.made.length > 0,
    outcome: !!(toc.outcomes.length > 0 || toc.evidence),
    learnings: !!toc.learnings,
  };
  const input = has.input && (place === 'input' || place === 'all');
  const output = has.output && (place === 'output' || place === 'all');
  const outcome = has.outcome && (place === 'results' || place === 'all');
  const learnings = has.learnings && (place === 'results' || place === 'all');
  return { input, output, outcome, learnings, any: input || output || outcome || learnings };
}
