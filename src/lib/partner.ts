/**
 * Which partner this build is for — `PARTNER=olimalar npm run build` reads
 * partners/olimalar.json. One template, one config file per partner (owner's
 * call, 29 Sep 2026: "i want to then do the same for thudippu foundation").
 *
 *   host     the partner's slug in Strapi's `hosts`; the site shows only the
 *            activities that list it as host
 *   primary  the partner's brand colour; everything else is aikyam.space's
 *            design system
 *   repo     the GitHub repository GitHub Pages serves the site from
 *   domain   the custom subdomain once the partner's DNS points at GitHub
 *            Pages; null until then, and the site is served under /<repo>/
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Partner {
  slug: string;
  host: string;
  name: string;
  website: string;
  primary: string;
  repo: string;
  domain: string | null;
}

export function loadPartner(slug = process.env.PARTNER ?? 'olimalar'): Partner {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`PARTNER must be a config name like "olimalar", got "${slug}"`);
  const p = JSON.parse(readFileSync(join(process.cwd(), 'partners', `${slug}.json`), 'utf8')) as Partner;
  for (const k of ['slug', 'host', 'name', 'website', 'primary', 'repo'] as const) {
    if (!p[k]) throw new Error(`partners/${slug}.json has no "${k}"`);
  }
  return p;
}

export const partner = loadPartner();
