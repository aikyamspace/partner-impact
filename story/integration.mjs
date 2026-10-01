/**
 * The PDF report and the story card for every activity, written at the end of
 * `astro build` to dist/activities/<slug>/record.pdf and story.jpg — the files
 * each activity page's "Report" and "Photo" links download.
 *
 * ⭐ The same A4 template aikyam.space prints its reports with (report.typ,
 * copied), with one change: the partner's own text-safe colour replaces aikyam
 * green for the report's links and headings.
 *
 * ⛔ The build NEEDS `typst` on PATH, and FAILS without it rather than shipping
 * pages whose Report link 404s.
 */
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pLimit from 'p-limit';
import sharp from 'sharp';
import { readTokens, tokensAsTypst } from './tokens.mjs';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..');

/** The story card's photo band is a 1080 SQUARE, so the cached photo has at
 *  least 1080 on its SHORT edge; the reports use the same cache (aikyam.space
 *  does the same). */
const SQUARE = 1080;
/** ⛔ Part of the cache filename: bump it whenever the transform changes. */
const PHOTO_VARIANT = 'sq1080.jpg';
/** The story card: 1080x1920, the size every phone's story format expects. */
const CARD = { width: 1080, height: 1920 };
/** ⛔ A safety cap, not a design limit (aikyam.space, 29 Sep 2026). */
const MAX_PAGES = 8;
const CONCURRENCY = 4;

export default function reports() {
  let siteUrl = null;
  let base = '/';
  let siteName = null;
  return {
    name: 'partner-impact:reports',
    hooks: {
      'astro:config:done': ({ config }) => {
        siteUrl = config.site;
        base = config.base;
        siteName = cardSite(config);
      },
      'astro:build:done': async ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const started = Date.now();
        if (!which('typst')) {
          throw new Error('reports: `typst` is not on PATH. Install it (`brew install typst`).');
        }

        const { ink, mint, records, cards } = await loadRecords(siteUrl, base);
        writeFileSync(
          path.join(here, 'tokens.typ'),
          tokensAsTypst({ ...readTokens(), 'aik-green-ink': ink, 'aik-mint': mint }),
        );
        const coverage = new Set(
          JSON.parse(readFileSync(path.join(here, 'font-coverage.json'), 'utf8')).codepoints,
        );
        guardText(records, coverage, logger);
        // A card prints only a date, the title and the credit: any character
        // no shipped font can draw fails the build, as the title does above.
        const undrawable = cards.flatMap((c) =>
          [...`${c.kicker}${c.title}${c.credit}`].filter((ch) => !coverage.has(ch.codePointAt(0))).map((ch) => `${c.slug}: ${codepoint(ch)}`));
        if (undrawable.length) throw new Error(`cards: characters no shipped font can draw:\n  ${[...new Set(undrawable)].join('\n  ')}`);
        const photos = await cachePhotos([...records, ...cards], logger);
        await renderCards(cards, photos, dist, siteName, logger);

        const jsonDir = path.join(repo, '.story-records');
        rmSync(jsonDir, { recursive: true, force: true });
        mkdirSync(jsonDir, { recursive: true });
        records.forEach((record, i) => {
          const file = path.join(jsonDir, `${i}.json`);
          writeFileSync(file, JSON.stringify(record));
          record.jsonPath = file;
        });

        const limit = pLimit(CONCURRENCY);
        const results = await Promise.all(
          records.map((record) => limit(() => renderRecord(record, photos, dist))),
        );
        if (results.length !== records.length) {
          throw new Error(`reports: wrote ${results.length} of ${records.length}`);
        }
        const bytes = results.reduce((sum, r) => sum + r.bytes, 0);
        const byPages = {};
        for (const r of results) byPages[r.pages] = (byPages[r.pages] ?? 0) + 1;
        logger.info(
          `${results.length} reports in ${((Date.now() - started) / 1000).toFixed(1)}s, ` +
            `${(bytes / 1024 / 1024).toFixed(1)} MB; pages per report: ` +
            Object.entries(byPages).map(([n, c]) => `${c} × ${n}`).join(', '),
        );
      },
    },
  };
}

function which(cmd) {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Through `tsx`, because the records come from the site's own TypeScript data layer. */
async function loadRecords(siteUrl, base) {
  const { stdout } = await execFileAsync(
    'npx',
    ['tsx', path.join(here, 'records.ts'), siteUrl, base],
    { cwd: repo, maxBuffer: 256 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

/**
 * A character no shipped font can draw would print as an empty box. In a name
 * or a site word that fails the build; in text an editor typed, it is removed
 * and named in the log — aikyam.space's rule.
 */
function guardText(records, coverage, logger) {
  const drawable = (ch) => coverage.has(ch.codePointAt(0));
  const missingIn = (value) => [...new Set([...String(value)].filter((ch) => !drawable(ch)))];
  const fatal = [];
  for (const record of records) {
    const lost = new Set();
    const clean = (text) => {
      let out = '';
      for (const ch of text) {
        if (drawable(ch)) out += ch;
        else lost.add(ch);
      }
      return out.replace(/\s+/g, ' ').trim();
    };
    const toc = record.toc;
    const strict = {
      title: record.title,
      tags: record.tags,
      license: record.license,
      how: toc.how ?? '',
      ...toc.headings,
      ...Object.fromEntries(record.facts.flatMap((f, i) => [[`fact ${i} label`, f.label], [`fact ${i} value`, f.value]])),
      ...Object.fromEntries(toc.input.map((f, i) => [`input ${i} label`, f.label])),
    };
    for (const [field, value] of Object.entries(strict)) {
      const missing = missingIn(value);
      if (missing.length) fatal.push(`${record.slug} ${field}: ${missing.map(codepoint).join(', ')}`);
    }
    for (const block of record.blocks) {
      if (block.kind === 'list') block.items = block.items.map(clean);
      else block.text = clean(block.text);
    }
    toc.input = toc.input.map((f) => ({ ...f, value: clean(f.value) }));
    toc.made = toc.made.map(clean);
    toc.outcomes = toc.outcomes.map(clean);
    for (const part of Object.keys(toc.tags)) {
      toc.tags[part] = toc.tags[part].map((tag) => ({ ...tag, name: clean(tag.name) }));
    }
    toc.evidence = toc.evidence.map(clean);
    toc.learnings = toc.learnings.map(clean);
    if (lost.size) {
      logger.warn(`report ${record.slug}: removed ${[...lost].map(codepoint).join(', ')} — no shipped font can draw it`);
    }
  }
  if (fatal.length) {
    throw new Error(
      `reports: ${fatal.length} field(s) carry characters no shipped font can draw. Fix the text in Strapi.\n` +
        fatal.map((f) => `  ${f}`).join('\n'),
    );
  }
}

function codepoint(ch) {
  return `${ch} (U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`;
}

/**
 * Each photograph fetched once from Strapi and kept in .story-photos/.
 * ⛔ JPEG, not WebP: Typst embeds a JPEG untouched; a WebP it re-encodes at
 * many times the size (aikyam.space measured 2.5 MB against 178 KB a page).
 * ⛔ A non-image body never reaches the cache, because the cache outlives the build.
 */
async function cachePhotos(records, logger) {
  const dir = path.join(repo, '.story-photos');
  mkdirSync(dir, { recursive: true });
  const urls = [...new Set(records.map((r) => r.photoUrl).filter(Boolean))];
  const paths = new Map();
  let fetched = 0;
  const limit = pLimit(6);
  await Promise.all(
    urls.map((url) =>
      limit(async () => {
        const name = path.basename(new URL(url).pathname).replace(/\.[^.]+$/, '');
        const file = path.join(dir, `${name}.${PHOTO_VARIANT}`);
        paths.set(url, file);
        if (existsSync(file) && statSync(file).size > 0) return;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`reports: photo ${url} fetched ${res.status}`);
        const type = res.headers.get('content-type') ?? '';
        if (!type.startsWith('image/')) throw new Error(`reports: photo ${url} came back as ${type || 'no content-type'}`);
        const original = Buffer.from(await res.arrayBuffer());
        if (original.length === 0) throw new Error(`reports: photo ${url} came back empty`);
        const body = await sharp(original)
          .rotate()
          .resize(SQUARE, SQUARE, { fit: 'outside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        const tmp = `${file}.part`;
        writeFileSync(tmp, body);
        renameSync(tmp, file);
        fetched += 1;
      }),
    ),
  );
  if (fetched) logger.info(`fetched ${fetched} new photo(s) into .story-photos/`);
  return paths;
}

/**
 * The address printed at the foot of every story card: the partner's own
 * impact domain once it is live, else the partner's website.
 */
function cardSite(config) {
  const slug = process.env.PARTNER ?? 'olimalar';
  const partner = JSON.parse(readFileSync(path.join(repo, 'partners', `${slug}.json`), 'utf8'));
  return partner.domain ?? new URL(partner.website).hostname.replace(/^www\./, '');
}

/**
 * One story card per activity at dist/activities/<slug>/story.jpg, set by
 * card.typ. ⛔ Typst writes PNG, not JPEG, so sharp encodes it — aikyam.space
 * uses macOS `sips` here, which the Ubuntu runner does not have.
 */
async function renderCards(cards, photos, dist, site, logger) {
  const started = Date.now();
  const limit = pLimit(CONCURRENCY);
  const sizes = await Promise.all(cards.map((card) => limit(async () => {
    const out = insideDist(dist, path.join(dist, 'activities', card.slug, 'story.jpg'));
    mkdirSync(path.dirname(out), { recursive: true });
    const args = [
      'compile',
      '--root', repo,
      '--font-path', path.join(here, 'fonts'),
      '--ignore-system-fonts',
      '--ppi', '72',
      '--format', 'png',
      '--input', `kicker=${card.kicker}`,
      '--input', `title=${card.title}`,
      '--input', `credit=${card.credit}`,
      '--input', `site=${site}`,
      '--input', 'malayalam=0',
    ];
    const photo = card.photoUrl ? photos.get(card.photoUrl) : null;
    if (photo) {
      args.push('--input', `photo=/${path.relative(repo, photo)}`);
      args.push('--input', `photo_w=${card.photoWidth}`);
      args.push('--input', `photo_h=${card.photoHeight}`);
    }
    args.push(path.join(here, 'render.typ'), '-');
    const { stdout, stderr } = await execFileAsync('typst', args, { cwd: repo, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
    if (/did not converge/.test(stderr.toString())) throw new Error(`cards: ${card.slug}: layout did not converge`);
    const jpeg = await sharp(stdout).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    // ⛔ The size is read back out of the file: a card that is not 1080x1920
    // is letterboxed or cropped by every phone.
    const { width, height } = await sharp(jpeg).metadata();
    if (width !== CARD.width || height !== CARD.height) {
      throw new Error(`cards: ${card.slug} came out ${width}x${height}, not ${CARD.width}x${CARD.height}`);
    }
    writeFileSync(out, jpeg);
    return jpeg.length;
  })));
  const bytes = sizes.reduce((a, b) => a + b, 0);
  logger.info(`${cards.length} story cards in ${((Date.now() - started) / 1000).toFixed(1)}s, ${(bytes / cards.length / 1024).toFixed(0)} KB each`);
}

/** ⛔ The slug is CMS text; path.join resolves `..`, so check the write stays in dist. */
function insideDist(dist, file) {
  if (!path.resolve(file).startsWith(path.resolve(dist) + path.sep)) {
    throw new Error(`reports: refusing to write outside dist: ${file}`);
  }
  return file;
}

function recordPath(dist, record) {
  return insideDist(dist, path.join(dist, 'activities', record.slug, 'record.pdf'));
}

async function renderRecord(record, photos, dist) {
  const out = recordPath(dist, record);
  mkdirSync(path.dirname(out), { recursive: true });
  const photo = record.photoUrl ? photos.get(record.photoUrl) : null;
  const bytes = await compileRecord(record, photo);
  const pages = pdfPageCount(bytes, record);
  if (pages > MAX_PAGES) {
    throw new Error(`reports: ${record.slug} came out ${pages} pages, over the ${MAX_PAGES}-page cap.`);
  }
  writeFileSync(out, bytes);
  return { pages, bytes: bytes.length };
}

async function compileRecord(record, photo) {
  const args = [
    'compile',
    '--root', repo,
    '--font-path', path.join(here, 'fonts'),
    '--ignore-system-fonts',
    '--format', 'pdf',
    '--input', `doc=/${path.relative(repo, record.jsonPath)}`,
  ];
  if (photo) {
    args.push('--input', `photo=/${path.relative(repo, photo)}`);
    args.push('--input', `photo_w=${record.photoWidth}`);
    args.push('--input', `photo_h=${record.photoHeight}`);
  }
  args.push(path.join(here, 'render-report.typ'), '-');
  const { stdout, stderr } = await execFileAsync('typst', args, {
    cwd: repo,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  });
  // ⛔ Typst warns "layout did not converge" and still exits 0 with a PDF whose
  // spacing may be wrong. That warning fails the build.
  const warnings = stderr.toString();
  if (/did not converge/.test(warnings)) {
    throw new Error(`reports: ${record.slug}: layout did not converge\n${warnings}`);
  }
  return stdout;
}

/** Page count out of the PDF's own page tree; throws rather than guessing. */
function pdfPageCount(buf, record) {
  const counts = [...buf.toString('latin1').matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  if (!counts.length) throw new Error(`reports: no page count in ${record.slug}`);
  return Math.max(...counts);
}
