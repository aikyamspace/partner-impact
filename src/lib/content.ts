/**
 * The small slice of aikyam.space's src/lib/content.ts that the components
 * copied from it (ActivityToc, ActivityCounts, ActivityFacilitators) import:
 * the interface-word lookup and the facilitator shape. Same names and shapes,
 * so those components are used here unchanged.
 */
import { uiStrings } from './strapi';

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** English only on partner sites (owner's call, 29 Sep 2026); `locale` is accepted and ignored. */
export async function getT(_locale?: string): Promise<Translate> {
  const strings = await uiStrings();
  return (key, vars) => {
    const raw = strings[key];
    if (raw === undefined) throw new Error(`ui-string "${key}" is missing in Strapi`);
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
  };
}

export interface HostCredit {
  name: string;
  slug: string | null;
  description: string | null;
  feature_image: string | null;
  feature_image_width: number | null;
  kind?: string;
}
