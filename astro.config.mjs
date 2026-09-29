// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import reports from './story/integration.mjs';

// Which partner — see src/lib/partner.ts. Read here too, because `site` and
// `base` decide every URL on the site.
const slug = process.env.PARTNER ?? 'olimalar';
const partner = JSON.parse(readFileSync(new URL(`./partners/${slug}.json`, import.meta.url), 'utf8'));

// ⭐ Before the partner's DNS points at GitHub Pages the site is served from
// https://aikyamspace.github.io/<repo>/, so every path carries /<repo>. Once
// `domain` is set in the partner file, the site moves to the subdomain root.
export default defineConfig({
  site: partner.domain ? `https://${partner.domain}` : 'https://aikyamspace.github.io',
  base: partner.domain ? '/' : `/${partner.repo}`,
  trailingSlash: 'always',
  output: 'static',
  image: {
    // Activity photos are resized at build time from the originals in Strapi.
    remotePatterns: [{ protocol: 'https', hostname: 'cms.folktaler.com' }],
  },
  integrations: [reports()],
});
