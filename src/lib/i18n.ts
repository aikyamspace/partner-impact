/** English only on partner sites (owner's call, 29 Sep 2026). Same exports the copied components import. */
export const LOCALES = ['en'] as const;
// ⚠️ The type keeps aikyam.space's two locales so the copied components, which
// branch on 'ml', type-check unchanged. Only 'en' is ever built.
export type Locale = 'en' | 'ml';
export const DEFAULT_LOCALE: Locale = 'en';
export function toLocale(_value: string | undefined): Locale {
  return DEFAULT_LOCALE;
}
