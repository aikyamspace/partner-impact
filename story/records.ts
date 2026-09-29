/**
 * The partner's activity reports as finished strings for story/report.typ —
 * the same A4 template aikyam.space prints its reports with (copied), fed from
 * this site's own data layer. Run by story/integration.mjs through `tsx`, which
 * prints the records as JSON.
 *
 * ⛔ Same rules as aikyam.space's story/lib/records.ts: an unrecorded fact
 * prints nothing (never a zero or a dash), a recorded zero is hidden, and the
 * wording comes from the same Strapi ui-strings the website uses.
 */
import { activities, uiStrings } from '../src/lib/strapi';
import { partner } from '../src/lib/partner';
import { brandColours } from '../src/lib/brand';
import { durationParts, formatInr, madeLine, paragraphsOf, EVIDENCE_KEY } from '../src/lib/toc';

type Block = { kind: 'p'; text: string } | { kind: 'quote'; text: string } | { kind: 'list'; items: string[] };
interface Fact { label: string; value: string; figure: boolean }

/* ---- the write-up, from HTML to blocks: aikyam.space's blocksOf(), widened
   to the tags a partner's write-up may carry (links, headings, images). ---- */
const STEP_ARROW = /[→⇒⟶➔➜➙]/g;
function stepsOf(text: string): string[] | null {
  const arrows = text.match(STEP_ARROW);
  if (!arrows || arrows.length < 2) return null;
  const steps = text.split(STEP_ARROW).map((p) => p.trim()).filter(Boolean);
  return steps.length >= 3 ? steps : null;
}
// ⛔ Anything outside this list stops the build rather than dropping out of a
// filed document silently. Images are left out of the PDF on purpose: the
// report carries the activity's main photograph only.
const KNOWN = new Set(['p', 'blockquote', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'br', 'a', 'u', 's', 'code', 'h2', 'h3', 'h4', 'figure', 'img', 'figcaption']);
function plain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”').replace(/&lsquo;/g, '‘').replace(/&rsquo;/g, '’')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&hellip;/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
}
export function blocksOf(html: string): Block[] {
  const strange = [...new Set([...html.matchAll(/<([a-z][a-z0-9]*)\b/g)].map((m) => m[1]))].filter((t) => !KNOWN.has(t));
  if (strange.length) throw new Error(`records: a write-up contains ${strange.join(', ')}; add it to KNOWN deliberately`);
  const blocks: Block[] = [];
  const noFigures = html.replace(/<figure\b[\s\S]*?<\/figure>/g, '');
  for (const m of noFigures.matchAll(/<(p|blockquote|ul|ol|h2|h3|h4)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const [, tag, inner] = m;
    if (tag === 'ul' || tag === 'ol') {
      const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((li) => plain(li[1])).filter(Boolean);
      if (items.length) blocks.push({ kind: 'list', items });
      continue;
    }
    const text = plain(inner);
    if (!text) continue;
    const steps = tag === 'p' ? stepsOf(text) : null;
    if (steps) blocks.push({ kind: 'list', items: steps });
    else blocks.push({ kind: tag === 'blockquote' ? 'quote' : 'p', text });
  }
  return blocks;
}

const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';

export async function records(siteUrl: string, base: string) {
  const [all, strings] = await Promise.all([activities(), uiStrings()]);
  const t = (key: string, vars?: Record<string, string | number>) => {
    const raw = strings[key];
    if (raw === undefined) throw new Error(`ui-string "${key}" is missing in Strapi`);
    return vars ? raw.replace(/\{(\w+)\}/g, (w, n: string) => (n in vars ? String(vars[n]) : w)) : raw;
  };
  const nf = new Intl.NumberFormat('en-IN');
  const dateFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const origin = siteUrl.replace(/\/$/, '') + base.replace(/\/$/, '');

  return all.map((a) => {
    const facts: Fact[] = [];
    const count = (key: string, v: number | null) => {
      if (v !== null && v > 0) facts.push({ label: t(key), value: nf.format(v), figure: true });
    };
    count('record.took_part', a.attendance.participants);
    count('record.facilitators', a.attendance.facilitators);
    count('record.watched', a.attendance.audience);
    facts.push({ label: t('record.run_by'), value: partner.name, figure: false });
    if (a.club) facts.push({ label: t('record.club'), value: a.club.name, figure: false });
    const names = a.facilitators.map((f) => f.name).filter((n) => n && n !== partner.name);
    if (names.length) facts.push({ label: t('record.facilitated_by'), value: names.join(', '), figure: false });

    const toc = a.toc;
    const input: Fact[] = [];
    if (toc.materials) input.push({ label: t('toc.materials'), value: toc.materials, figure: false });
    if (toc.outsideHelp) input.push({ label: t('toc.outside_help'), value: toc.outsideHelp, figure: false });
    const d = durationParts(toc.hours);
    if (d) input.push({ label: t('toc.time'), value: t(d.key, { n: nf.format(d.n) }), figure: false });
    if (toc.costInr !== null) input.push({ label: t('toc.cost'), value: formatInr(toc.costInr, 'en'), figure: false });
    const evidence = paragraphsOf(toc.evidence);
    const href = `${origin}/activities/${a.slug}/`;

    return {
      slug: a.slug,
      locale: 'en',
      tags: a.club?.name ?? partner.name,
      date: dateFmt.format(new Date(a.date)),
      title: a.title,
      photoUrl: a.photo?.src ?? null,
      photoWidth: a.photo?.width ?? 0,
      photoHeight: a.photo?.height ?? 0,
      facts,
      blocks: blocksOf(a.bodyHtml),
      toc: {
        headings: { input: t('toc.input'), activity: t('toc.activity'), output: t('toc.output'), outcome: t('toc.outcome'), learnings: t('toc.learnings') },
        input,
        made: toc.made.map((m) => madeLine(m, nf)),
        outcomes: toc.outcomes,
        evidence,
        how: evidence.length > 0 && toc.evidenceType ? `(${t(EVIDENCE_KEY[toc.evidenceType])})` : null,
        learnings: paragraphsOf(toc.learnings),
      },
      url: encodeURI(href),
      urlShown: href.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      pageOf: t('record.page_of'),
      malayalam: false,
      license: t('record.license'),
      licenseUrl: LICENSE_URL,
    };
  });
}

// `tsx story/records.ts <siteUrl> <base>` prints `{ ink, records }` as JSON:
// the partner's text-safe colour (for the report's links and headings) and
// every record.
if (process.argv[1]?.endsWith('records.ts')) {
  const [siteUrl = 'https://aikyamspace.github.io', base = '/'] = process.argv.slice(2);
  records(siteUrl, base).then((r) =>
    process.stdout.write(JSON.stringify({ ink: brandColours(partner.primary).ink, records: r })),
  );
}
