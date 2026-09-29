/**
 * A site path with the deploy base in front: `/olimalar-impact/…` on the
 * GitHub Pages preview, `/…` once the partner's own subdomain is set.
 * The copied components call `localeHref(path, locale)`; locale is ignored.
 */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
export function localeHref(path: string, _locale?: string): string {
  return href(path);
}
