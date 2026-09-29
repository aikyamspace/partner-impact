/**
 * The partner's colour, and a darker shade of it that is safe as TEXT.
 *
 * ⭐ Owner's call, 29 Sep 2026: "just primary colors maybe and rest can be same
 * as aikyam space". The partner's brand colour replaces aikyam's green; the
 * rest of the design system is unchanged.
 * ⛔ A brand colour is rarely dark enough for text on aikyam's cream paper
 * (Olimalar's #5474fc is about 3.8:1). Headings use `ink`: the same hue,
 * darkened step by step until it reaches 4.5:1 (WCAG AA for normal text) on
 * the page. culori does the colour maths; nothing here is hand-rolled.
 */
import { formatHex, oklch, wcagContrast } from 'culori';

const PAPER = '#f7f2ec'; // --aik-paper, src/styles/tokens/colors.css

export function brandColours(primary: string): { primary: string; ink: string; inkContrast: number } {
  const start = oklch(primary);
  if (!start) throw new Error(`Partner primary colour "${primary}" is not a colour`);
  let ink = { ...start };
  for (let i = 0; i < 60 && wcagContrast(ink, PAPER) < 4.5; i++) {
    ink = { ...ink, l: ink.l - 0.01 };
  }
  const contrast = wcagContrast(ink, PAPER);
  if (contrast < 4.5) throw new Error(`Could not darken ${primary} to 4.5:1 on paper`);
  return { primary: formatHex(start) as string, ink: formatHex(ink) as string, inkContrast: Math.round(contrast * 100) / 100 };
}
