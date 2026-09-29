/**
 * The PDF report for every activity, written at the end of `astro build` to
 * dist/activities/<slug>/record.pdf — the file each activity page's "Report"
 * link downloads.
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

/** Long edge of the cached photograph. The report's photo band is 110mm by the
 *  text column; 1600px is well past print sharpness for that. */
const PHOTO_EDGE = 1600;
/** ⛔ Part of the cache filename: bump it whenever the transform changes. */
const PHOTO_VARIANT = 'r1600.jpg';
/** ⛔ A safety cap, not a design limit (aikyam.space, 29 Sep 2026). */
const MAX_PAGES = 8;
const CONCURRENCY = 4;

export default function reports() {
  let siteUrl = null;
  let base = '/';
  return {
    name: 'partner-impact:reports',
    hooks: {
      'astro:config:done': ({ config }) => {
        siteUrl = config.site;
        base = config.base;
      },
      'astro:build:done': async ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const started = Date.now();
        if (!which('typst')) {
          throw new Error('reports: `typst` is not on PATH. Install it (`brew install typst`).');
        }

        const { ink, records } = await loadRecords(siteUrl, base);
        writeFileSync(
          path.join(here, 'tokens.typ'),
          tokensAsTypst({ ...readTokens(), 'aik-green-ink': ink }),
        );
        const coverage = new Set(
          JSON.parse(readFileSync(path.join(here, 'font-coverage.json'), 'utf8')).codepoints,
        );
        guardText(records, coverage, logger);
        const photos = await cachePhotos(records, logger);

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
          .resize(PHOTO_EDGE, PHOTO_EDGE, { fit: 'inside', withoutEnlargement: true })
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

/** ⛔ The slug is CMS text; path.join resolves `..`, so check the write stays in dist. */
function recordPath(dist, record) {
  const file = path.join(dist, 'activities', record.slug, 'record.pdf');
  if (!path.resolve(file).startsWith(path.resolve(dist) + path.sep)) {
    throw new Error(`reports: refusing to write outside dist: ${file}`);
  }
  return file;
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
