/**
 * Reads the partner's published activities from Strapi (cms.folktaler.com) —
 * the same CMS and the same records aikyam.space builds from, filtered to the
 * activities that list this partner as host.
 *
 * ⛔ The token is read-only and cannot read `person` (names and contact
 * details stay out of every public build). In CI it comes from the
 * STRAPI_TOKEN secret; on the owner's Mac from ~/_work/strapi-partner-build.json.
 * It is never written anywhere in this repository.
 * ⛔ Published content only: nothing here asks Strapi for drafts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { partner } from './partner';
import { blocksToHtml, type BlockNode } from './blocks-to-html';

const BASE = 'https://cms.folktaler.com';
type Doc = Record<string, any>;

function token(): string {
  if (process.env.STRAPI_TOKEN) return process.env.STRAPI_TOKEN;
  const file = join(homedir(), '_work', 'strapi-partner-build.json');
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')).build_token;
  throw new Error('No Strapi token: set STRAPI_TOKEN (CI) or create ~/_work/strapi-partner-build.json');
}

/** Every page of a collection; the rows read must equal the server's own total. */
async function findAll(plural: string, params: Record<string, string>): Promise<Doc[]> {
  const rows: Doc[] = [];
  let page = 1;
  let pageCount = 1;
  let total = 0;
  do {
    const q = new URLSearchParams({ locale: 'en', 'pagination[page]': String(page), 'pagination[pageSize]': '100', ...params });
    const res = await fetch(`${BASE}/api/${plural}?${q}`, { headers: { Authorization: `Bearer ${token()}`, 'User-Agent': 'partner-impact-build' } });
    if (!res.ok) throw new Error(`Strapi ${res.status} for ${plural}: ${(await res.text()).slice(0, 200)}`);
    const body = await res.json();
    rows.push(...body.data);
    pageCount = body.meta.pagination.pageCount;
    total = body.meta.pagination.total;
    page++;
  } while (page <= pageCount);
  if (rows.length !== total) throw new Error(`Strapi ${plural}: read ${rows.length} of ${total} rows`);
  return rows;
}

const cache = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, load());
  return cache.get(key) as Promise<T>;
}

export interface Photo {
  src: string;
  width: number;
  height: number;
  alt: string;
}
function photoOf(m: Doc | null | undefined, alt: string): Photo | null {
  if (!m?.url || !m.width || !m.height) return null;
  return { src: m.url.startsWith('http') ? m.url : BASE + m.url, width: m.width, height: m.height, alt: m.alternativeText || alt };
}

/** One attendance group's number, the aikyam.space rule: null = not recorded, 0 stays 0. */
function count(g: Doc | null | undefined): number | null {
  if (!g) return null;
  const unnamed = g.unnamed_count ?? null;
  const named = g.people_count ?? 0;
  if (unnamed === null && named === 0) return null;
  return (unnamed ?? 0) + named;
}

const nonEmpty = (s: string | null | undefined) => (s && s.trim() ? s : null);
const tagsOf = (list: Doc[] | null | undefined) => (list ?? []).map((t: Doc) => ({ name: t.name as string, slug: t.slug as string }));

/** Owner-written SEO overrides from Strapi; null = not written, use the page's own text. */
export interface Seo {
  metaTitle: string | null;
  metaDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
}
function seoOf(d: Doc): Seo {
  return {
    metaTitle: nonEmpty(d.meta_title),
    metaDescription: nonEmpty(d.meta_description),
    ogTitle: nonEmpty(d.og_title),
    ogDescription: nonEmpty(d.og_description),
  };
}

export interface Activity {
  slug: string;
  title: string;
  date: string;
  excerpt: string | null;
  bodyHtml: string;
  photo: Photo | null;
  club: { slug: string; name: string } | null;
  facilitators: { name: string; slug: null; description: null; feature_image: null; feature_image_width: null; kind: string }[];
  /** Every host of the activity, in the CMS's order — an activity can be co-hosted. */
  hosts: { name: string; kind: string; slug: string }[];
  seo: Seo;
  /** The editor's chosen share image, else the activity photo. */
  shareImage: Photo | null;
  space: { slug: string; name: string; locality: string | null } | null;
  attendance: { participants: number | null; facilitators: number | null; audience: number | null };
  toc: import('./toc').ActivityToc;
}

export function host(): Promise<{ name: string; description: string | null; photo: Photo | null }> {
  return once('host', async () => {
    const [h] = await findAll('hosts', { 'filters[slug][$eq]': partner.host, 'populate[0]': 'feature_image' });
    if (!h) throw new Error(`No Strapi host "${partner.host}"`);
    return { name: h.name, description: nonEmpty(h.description), photo: photoOf(h.feature_image, h.name) };
  });
}

/** The partner's published activities, newest first. */
export function activities(): Promise<Activity[]> {
  return once('activities', async () => {
    const rows = await findAll('activities', {
      'filters[hosts][slug][$eq]': partner.host,
      'filters[archived][$eq]': 'false',
      'sort[0]': 'happened_on:desc',
      'populate[photo]': 'true',
      'populate[og_image]': 'true',
      'populate[club][fields][0]': 'slug',
      'populate[club][fields][1]': 'name',
      'populate[facilitators][fields][0]': 'name',
      'populate[facilitators][fields][1]': 'kind',
      // Tags, owner's calls 30 Sep 2026: one shared list, five fields.
      ...Object.fromEntries(
        ['input_tags', 'output_tags', 'outcome_tags', 'learning_tags', 'activity_tags'].flatMap((f) => [
          [`populate[${f}][fields][0]`, 'name'],
          [`populate[${f}][fields][1]`, 'slug'],
        ]),
      ),
      'populate[hosts][fields][0]': 'name',
      'populate[hosts][fields][1]': 'kind',
      'populate[hosts][fields][2]': 'archived',
      'populate[hosts][fields][3]': 'slug',
      'populate[space][fields][0]': 'name',
      'populate[space][fields][1]': 'locality',
      'populate[space][fields][2]': 'archived',
      'populate[space][fields][3]': 'slug',
      'populate[took_part]': 'true',
      'populate[facilitated]': 'true',
      'populate[watched]': 'true',
      'populate[made]': 'true',
      'populate[outcomes][fields][0]': 'name',
      'populate[outcomes][fields][1]': 'sort',
    });
    return rows.map((a) => {
      const hosts = (a.hosts ?? []).filter((h: Doc) => !h.archived).map((h: Doc) => ({ name: h.name, kind: h.kind, slug: h.slug }));
      const named = (a.facilitators ?? []).map((f: Doc) => ({ name: f.name, kind: f.kind }));
      // aikyam.space's facilitatorsOf(): with nobody named, a host who is a person facilitated.
      const facilitators = named.length > 0 ? named : hosts.filter((h: { kind: string }) => h.kind === 'person');
      return {
      slug: a.slug,
      title: a.title,
      date: a.happened_on,
      excerpt: nonEmpty(a.excerpt),
      bodyHtml: blocksToHtml(a.body as BlockNode[], { imageSrc: (n) => (n.image.url.startsWith('http') ? n.image.url : BASE + n.image.url) }),
      photo: photoOf(a.photo, a.title),
      club: a.club ? { slug: a.club.slug, name: a.club.name } : null,
      // Unlinked on purpose: a facilitator's own page lives on aikyam.space, not here.
      facilitators: facilitators.map((f: { name: string; kind: string }) => ({ name: f.name, slug: null, description: null, feature_image: null, feature_image_width: null, kind: f.kind })),
      hosts,
      seo: seoOf(a),
      shareImage: photoOf(a.og_image, a.title) ?? photoOf(a.photo, a.title),
      space: a.space && !a.space.archived ? { slug: a.space.slug, name: a.space.name, locality: a.space.locality ?? null } : null,
      attendance: { participants: count(a.took_part), facilitators: count(a.facilitated), audience: count(a.watched) },
      toc: {
        materials: nonEmpty(a.materials_used),
        outsideHelp: nonEmpty(a.outside_help),
        hours: a.hours == null ? null : Number(a.hours),
        costInr: a.cost_inr ?? null,
        made: (a.made ?? []).filter((m: Doc) => m.item?.trim()).map((m: Doc) => ({ item: m.item, quantity: m.quantity ?? null })),
        // Outcome TAGS since 30 Sep 2026; an activity whose live version predates
        // the copy (an editor had an unpublished change) keeps its old outcomes.
        outcomes: (a.outcome_tags?.length
          ? a.outcome_tags
          : (a.outcomes ?? []).slice().sort((x: Doc, y: Doc) => (x.sort ?? 0) - (y.sort ?? 0))
        ).map((o: Doc) => o.name),
        evidence: nonEmpty(a.outcome_evidence),
        evidenceType: a.evidence_type ?? null,
        learnings: nonEmpty(a.learnings),
        tags: {
          input: tagsOf(a.input_tags),
          output: tagsOf(a.output_tags),
          outcome: tagsOf(a.outcome_tags),
          learning: tagsOf(a.learning_tags),
          activity: tagsOf(a.activity_tags),
        },
      },
      };
    });
  });
}

/** The clubs the partner's activities belong to, with their own description from Strapi. */
export function clubs(): Promise<{ slug: string; name: string; description: string | null; photo: Photo | null; seo: Seo }[]> {
  return once('clubs', async () => {
    const slugs = [...new Set((await activities()).map((a) => a.club?.slug).filter(Boolean))] as string[];
    if (slugs.length === 0) return [];
    const params: Record<string, string> = { 'populate[0]': 'photo' };
    slugs.forEach((s, i) => (params[`filters[slug][$in][${i}]`] = s));
    const rows = await findAll('clubs', params);
    return rows.map((c) => ({ slug: c.slug, name: c.name, description: nonEmpty(c.description), photo: photoOf(c.photo, c.name), seo: seoOf(c) }));
  });
}

/** The site's interface words (English), from the same ui-strings aikyam.space uses. */
export function uiStrings(): Promise<Record<string, string>> {
  return once('ui', async () => {
    const rows = await findAll('ui-strings', { 'filters[archived][$eq]': 'false', 'fields[0]': 'key', 'fields[1]': 'value' });
    return Object.fromEntries(rows.map((u) => [u.key, u.value]));
  });
}
