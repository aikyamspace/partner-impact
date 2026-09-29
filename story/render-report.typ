// The compile entry point: one record, from `--input` values.
//
// ⛔ THE RECORD'S CONTENT ARRIVES AS A JSON FILE, not as --input strings. A
// write-up runs to 2,586 characters across seventeen paragraphs with quotes and
// apostrophes in it; passing that through a command line is a quoting problem
// waiting to happen, and Typst's `json()` reads a file with no such ceiling.
// ⛔ THE FILE IS NAMED BY INDEX, NEVER BY SLUG. A real published slug in this
// corpus is 255 characters long WITH SPACES — the slug itself is 288 characters
// and the directory name is what the filesystem truncated it to — so
// `<slug>-<locale>.json` exceeds the per-component limit and the write fails.
//
// ⛔⛔ `#set document(date: none)` IS LOAD-BEARING, NOT TIDINESS. Typst stamps a
// PDF with its creation time TO THE SECOND. Without this line every one of the
// 506 records differs on every build — and differs WITHIN a single build, since
// they do not all compile in the same second — so wrangler, which uploads only
// hashes Cloudflare does not already hold, would re-upload all of them every
// morning for ever. It also makes the determinism argument that justified
// having no render cache false for half the output. Verified both ways: with
// this line, two compiles of the same record are byte-identical.

#import "report.typ": record

#let inputs = sys.inputs
#let doc = json(inputs.doc)
#let has(k) = k in inputs and inputs.at(k) != ""

#set document(date: none, title: doc.title, author: "aikyam space")

#record(
  tags: doc.tags,
  date: doc.date,
  title: doc.title,
  photo: if has("photo") { inputs.photo } else { none },
  photo-w: if has("photo_w") { int(inputs.photo_w) } else { 0 },
  photo-h: if has("photo_h") { int(inputs.photo_h) } else { 0 },
  facts: doc.facts,
  blocks: doc.blocks,
  toc: doc.toc,
  url: doc.url,
  url-shown: doc.urlShown,
  page-of-template: doc.pageOf,
  malayalam: doc.malayalam,
  license: doc.license,
  license-url: doc.licenseUrl,
)
