// One activity's printable record — A4, for a non-profit's annual report.
//
// ⛔⛔ WHY THIS EXISTS, because it decides every argument below. A non-profit
// must file evidence of its work and usually cannot, because nobody wrote it
// down at the time. This sheet is that evidence: one activity, its facts, and
// the account somebody wrote on the day, on a page that goes into a folder.
// It is NOT a prettier web page. Where the website can afford to be inviting,
// this has to be CHECKABLE — which is why an unrecorded fact prints nothing at
// all rather than a zero or a dash.
//
// ⛔ THE GROUND IS PAPER AND THE TYPE IS INK — the inverse of the share card,
// deliberately. The card is a photograph somebody posts; this is a document
// somebody prints, and ink on cream is what a printer can actually put down.
//
// ⛔ THE HEADER IS THE TOPIC TAGS AND NOTHING ELSE — owner's ruling, 17 Sep
// 2026, which replaced his own ruling of the same morning that it carry the
// running organisation. The organisation did not leave the sheet: it is in the
// facts as "Run by", now the only place it appears.
//
// ⛔ NO LOGO AND NO CLASP MARK. The owner's call, the same one the card
// carries. The foot's live URL is the whole of the branding, and it has
// aikyam.space inside it.
//
// Colours come from tokens.typ, generated from the design system's own
// colors.css. Never write a hex into this file.

#import "tokens.typ": *

// A4, and the margin is a real print margin rather than a design flourish:
// 18mm clears the unprintable edge of every consumer printer and leaves room
// for a hole-punch on the left when this goes into a ring binder.
#let MARGIN = 18mm
#let PAGE_W = 210mm
#let COL = PAGE_W - MARGIN * 2

// ⛔ THE SAME CROP RULE AS THE SHARE CARD, AND THE SAME REASON — heads sit in
// the upper half of a candid phone photograph, so a centred crop decapitates
// people. card.typ's PHOTO_FOCUS carries the full account.
#let PHOTO_FOCUS = 0.35

// ⛔⛔ THE PHOTOGRAPH IS CROPPED BUT NEVER ENLARGED. This does NOT follow the
// share card's reversal of 17 Sep 2026: that reversal was granted to the card
// alone, because a card exists to be cropped to a square for Instagram. A
// filed record has no such job, so the owner's original rule of 16 Sep stands
// here — a small photograph gets a shorter band rather than being blown up
// into a soft one on a page somebody prints and keeps.
#let photo-band(photo, photo-w, photo-h, height) = {
  // Scale so the WIDTH fills the column, and never past 1:1.
  let by-width = COL / (photo-w * 1pt)
  let scale = calc.min(by-width, 1.0)
  let shown-w = photo-w * 1pt * scale
  let shown-h = photo-h * 1pt * scale
  // A photograph too small to fill the column keeps its own smaller box rather
  // than stretching; a photograph taller than the band is cropped top-biased.
  let band-h = calc.min(height, shown-h)
  let over-y = calc.max(0pt, shown-h - band-h)
  let over-x = calc.max(0pt, shown-w - COL)
  align(left, box(width: calc.min(COL, shown-w), height: band-h, clip: true,
    // ⛔ BOTH DIMENSIONS ARE PASSED. `image()` defaults to `fit: "cover"` and
    // centre-crops BEFORE any move() can position it — the bug that shipped on
    // the share card on 16 Sep 2026 and cut a child's head off 23 of them.
    move(dy: -over-y * PHOTO_FOCUS, dx: -over-x * 0.5,
      image(photo, width: shown-w, height: shown-h)),
  ))
}

// "page {n} of {m}" with Typst's own counters in the slots. ⛔ The whole
// sentence is one translated string: Malayalam joins the two numbers with a
// slash rather than a word, so a template built from a translated "of" would
// be wrong there. See `record.page_of`.
#let page-of(template) = context {
  let n = counter(page).get().first()
  let m = counter(page).final().first()
  template.replace("{n}", str(n)).replace("{m}", str(m))
}

#let record(
  tags: "",
  date: "",
  title: "",
  photo: none,
  photo-w: 0,
  photo-h: 0,
  facts: (),
  blocks: (),
  toc: none,
  url: "",
  url-shown: "",
  page-of-template: "page {n} of {m}",
  malayalam: false,
  license: "",
  license-url: "",
) = {
  // Always full size since 29 Sep 2026: a report runs to as many pages as it
  // needs rather than shrinking to fit one (see story/integration.mjs).
  let photo-h-mm = 110mm
  let body-size = 11pt
  let face = ("Figtree", "Noto Sans Malayalam")
  // ⚠️ Malayalam needs more leading: its vowel signs and conjuncts reach well
  // above and below the Latin band. Same reasoning as card.typ, smaller
  // numbers because this is body text rather than a headline.
  let body-leading = if malayalam { 0.95em } else { 0.75em }
  let head-leading = if malayalam { 0.60em } else { 0.42em }
  let head-tracking = if malayalam { 0pt } else { -0.01em }
  let head-size = if malayalam { 19pt } else { 21pt }

  set page(
    paper: "a4",
    margin: MARGIN,
    fill: aik_paper,
    // ⭐ A REAL RUNNING HEADER AND FOOTER, not blocks in the flow — so the
    // seven records that run to a second sheet repeat them without any code
    // here knowing about pagination. A loose second page still says whose it is,
    // which page it is, and where the record lives.
    header: {
      set text(size: 9pt, fill: aik_ink_quiet, font: face)
      grid(columns: (1fr, auto),
        text(weight: 500, fill: aik_ink)[#tags],
        page-of(page-of-template),
      )
      v(4pt)
      line(length: 100%, stroke: 0.5pt + aik_rule)
    },
    footer: {
      line(length: 100%, stroke: 0.5pt + aik_rule)
      v(5pt)
      set text(size: 9pt, font: face)
      // ⛔ A LIVE LINK, NOT A WORDMARK — owner's ruling, 17 Sep 2026. It takes a
      // reader from a printed sheet back to the record online, which a wordmark
      // cannot do, and it carries aikyam.space inside it so the page is still
      // attributable. The scheme is dropped from what is SHOWN and kept in what
      // is followed.
      link(url, text(fill: aik_green_ink)[#url-shown])
    },
  )
  set text(font: face, fill: aik_ink, size: body-size, lang: if malayalam { "ml" } else { "en" })
  // ⛔ Hyphenation off. It mangles a proper noun and there is no Malayalam
  // hyphenation dictionary here at all, so leaving it on would be a Latin-only
  // behaviour applied to one language and not the other.
  set par(justify: false, leading: body-leading)
  set text(hyphenate: false)

  // ⭐ SPACING, owner's review of 29 Sep 2026 ("seems tight"), the same rule as
  // the activity page: a heading sits close to its own text and well away from
  // what came before it, and the three groups are clearly apart. Measured
  // before (pdftotext box positions): 5pt under a heading, 11pt between
  // sections and around group lines; 19.2pt between write-up paragraphs and
  // 13.2pt between Outcome/Learnings paragraphs (a v(6pt) ADDED to Typst's
  // default 1.2em), so the headings floated and the rhythm was uneven.
  // ⛔ HOW TYPST COMBINES SPACING, measured in 0.15.1 — every value below relies
  // on it: a v() between two paragraphs ADDS to paragraph spacing; a block's
  // own above/below REPLACES paragraph spacing beside it; between two blocks
  // the larger wins. So this template uses paragraph spacing and each block's
  // above/below, and no v() between flowing paragraphs.
  let HEAD-BELOW = 8pt   // a heading to its own text
  let SECTION = 18pt     // between sections inside a group
  let GROUP = 20pt       // each side of a group's line
  // Between paragraphs, tied to line spacing so it always reads as a break:
  // 1.2em (13.2pt) against 0.75em leading in English, 1.5em (16.5pt) against
  // 0.95em in Malayalam — a fixed 9pt was LESS than a Malayalam line gap.
  let PARA = if malayalam { 1.5em } else { 1.2em }
  let DATE-GAP = 5pt     // the date to the title
  let PHOTO-GAP = 12pt   // the title to the photograph
  let FACTS-GAP = 14pt   // around the facts block and its closing rule
  set par(spacing: PARA)

  // The date leads, because a filed record is found by when it happened.
  text(size: 9pt, weight: 500, tracking: 0.08em, fill: aik_ink_quiet)[#upper(date)]
  v(DATE-GAP)
  block(below: 0pt, text(
    size: head-size, weight: 600, tracking: head-tracking,
    top-edge: "cap-height", bottom-edge: "baseline",
  )[#par(leading: head-leading)[#title]])

  if photo != none {
    v(PHOTO-GAP)
    photo-band(photo, photo-w, photo-h, photo-h-mm)
  } else {
    // ⚠️ A record with no photograph needs MORE air here, not less. With a
    // photograph the facts are separated from the title by the whole band;
    // without one they ran straight into it. Exactly one published activity
    // has no photograph today (a-fee-paying-dance-class-started-with-the-
    // students) — the same row card.typ's sunk-paper ground was built for.
    v(7pt)
  }

  // The facts. Two columns of label/value, which is what makes this a record
  // rather than a story.
  // ⛔ EVERY ROW HERE IS ALREADY EARNED — records.ts omits a fact that was
  // never recorded, so this never has to decide what to hide. A recorded zero
  // is hidden too, the same rule the website applies.
  // ⛔⛔ ONE GRID OF FOUR COLUMNS, NOT A GRID OF GRIDS — and that is a bug fix,
  // not a preference. Each row used to be its own nested grid with a fixed
  // 26mm label column, which is fine for "Facilitators" and far too narrow for
  // "ഫെസിലിറ്റേറ്റർമാർ": the Malayalam label overran its cell and the figure
  // was drawn ON TOP of it. Sharing one grid lets Typst size the label columns
  // to their own widest content, in each language, and keeps the two values
  // aligned down the page — which two independent `auto` grids would not.
  if facts.len() > 0 {
    v(FACTS-GAP)
    set text(size: 10pt)
    grid(
      columns: (auto, 1fr, auto, 1fr),
      // Tight between a label and its value, wide between the two halves, so
      // the pairs read as pairs rather than as four loose columns.
      column-gutter: (4mm, 10mm, 4mm),
      row-gutter: 5pt,
      ..facts
        .map(fact => (
          text(fill: aik_ink_quiet)[#fact.label],
          text(weight: if fact.figure { 600 } else { 400 })[#fact.value],
        ))
        .flatten(),
    )
  }

  v(FACTS-GAP)
  line(length: 100%, stroke: 0.5pt + aik_rule)
  v(FACTS-GAP)

  // ⭐ INPUT, THEN THE ACTIVITY, THEN WHAT CAME OF IT — the theory-of-change
  // order the activity page uses (owner, 29 Sep 2026), with the same green
  // headings he chose there. When Input prints, the write-up is headed
  // "Activity" so it does not read as part of Input.
  // ⛔ Every part is already filtered by records.ts: an empty one is an empty
  // list and prints nothing.
  // ⭐ `sticky`: a heading, and a group's line, stay on the same page as what
  // follows them. Without it a group line was stranded at the foot of page 1
  // with its whole group on page 2 (owner's review, 29 Sep 2026).
  // `above` is the space before a heading: 0 where a group line or the facts
  // rule already provides it, SECTION between sections inside a group.
  let toc-head(label, above: 0pt) = block(sticky: true, above: above, below: HEAD-BELOW,
    text(size: 12pt, weight: 600, fill: aik_green_ink)[#label])
  // ⭐ OWNER'S RULING, 29 Sep 2026 ("Drop it", after the comparison page): a
  // group that starts a new page gets no line of its own, because the running
  // header's rule is already right above it.
  // ⛔⛔ ONLY THE LINE IS CONDITIONAL, NEVER THE SPACE. A block whose HEIGHT
  // depends on where it lands makes Typst's layout oscillate near a page foot
  // (drawn → too tall → moved to the next page → at the top, nothing drawn →
  // fits again): measured in review, it failed to converge and printed a group
  // with no line and no gap. So the block is always one hairline plus GROUP
  // tall, and only the hairline is hidden at a page top. The visible cost, shown
  // to the owner in the comparison page (version 3, 29 Sep 2026): a group that
  // starts a page begins GROUP (20pt) below the header's rule.
  let group-line() = block(sticky: true, above: GROUP, below: GROUP, context {
    let rule = line(length: 100%, stroke: 0.5pt + aik_rule)
    // `hide` keeps the rule's size and draws nothing, so the block is the same
    // height wherever it lands.
    if here().position().y <= MARGIN + 4mm { hide(rule) } else { rule }
  })
  let has-input = toc != none and toc.input.len() > 0
  if has-input {
    toc-head(toc.headings.input)
    {
      set text(size: 10pt)
      grid(columns: (auto, 1fr), column-gutter: 4mm, row-gutter: 5pt,
        ..toc.input.map(f => (text(fill: aik_ink_quiet)[#f.label], [#f.value])).flatten())
    }
    // The first group's line (owner's three groups, 29 Sep 2026).
    group-line()
    toc-head(toc.headings.activity)
  }

  // The account of what happened, in the words somebody wrote on the day.
  // Paragraphs flow with PARA between them; a quote or a list is a block with
  // PARA above and below, which REPLACES the paragraph spacing beside it.
  for b in blocks {
    if b.kind == "quote" {
      // ⛔⛔ SET APART AND UNLABELLED. The owner ruled against a "What we learnt"
      // heading for the website and that ruling holds in print: the rule and
      // the indent do the work a heading would. A label would also be a claim
      // about what the quoted passage IS, which the data does not make.
      block(
        above: PARA, below: PARA,
        inset: (left: 5mm),
        stroke: (left: 1.2pt + aik_ink_quiet),
      )[#b.text]
    } else if b.kind == "list" {
      // Typst's own list, so the markers and hanging indent are consistent
      // with nothing else on the page having to be told about them.
      block(above: PARA, below: PARA, list(..b.items))
    } else {
      par[#b.text]
    }
  }

  // Output stays in the Activity group, straight after the write-up.
  if toc != none and toc.made.len() > 0 {
    toc-head(toc.headings.output, above: SECTION)
    list(..toc.made)
  }
  // The third group, Outcome + Learnings, opens with the second line.
  let has-results = toc != none and (toc.outcomes.len() > 0
    or toc.evidence.len() > 0 or toc.learnings.len() > 0)
  if has-results {
    group-line()
    let has-outcome = toc.outcomes.len() > 0 or toc.evidence.len() > 0
    if has-outcome {
      toc-head(toc.headings.outcome)
      // The outcome labels: a block, so its 10pt `below` REPLACES paragraph
      // spacing before the first evidence paragraph, however many there are.
      if toc.outcomes.len() > 0 {
        block(sticky: true, below: 10pt, text(weight: 500)[#toc.outcomes.join(" · ")])
      }
      // ⛔ "(We observed it)" qualifies the evidence, so it is the last LINE of
      // the last evidence paragraph (a line break, not a new block): a page
      // can then break inside a long paragraph as usual, and Typst's widow
      // control keeps the qualifier with the line before it. The box's top
      // inset lifts it clear of the evidence's descenders.
      let ev = toc.evidence
      for (i, p) in ev.enumerate() {
        if i == ev.len() - 1 and toc.how != none {
          par[#p#linebreak()#box(inset: (top: 4pt), text(size: 9pt, fill: aik_ink_quiet)[#toc.how])]
        } else {
          par[#p]
        }
      }
    }
    if toc.learnings.len() > 0 {
      toc-head(toc.headings.learnings, above: if has-outcome { SECTION } else { 0pt })
      for p in toc.learnings { par[#p] }
    }
  }

  // ⭐ THE LICENCE, owner's call 29 Sep 2026: CC BY 4.0 for the text,
  // photographs all rights reserved — worded after Creative Commons' own FAQ
  // for offline material ("This work is licensed under… To view a copy of the
  // license, visit [url]"). It closes the report rather than sitting in the
  // footer band, because the footer is a fixed height and a long line there
  // overflows (see RecordDoc.urlShown). The address inside it is a live link.
  if license != "" {
    v(14pt)
    line(length: 100%, stroke: 0.5pt + aik_rule)
    v(6pt)
    set text(size: 8.5pt, fill: aik_ink_quiet)
    set par(leading: 0.6em)
    // Every occurrence of the address becomes the link, however the wording
    // is edited in the CMS — a fixed two-part split would fail the build.
    let pieces = if license-url != "" { license.split(license-url) } else { (license,) }
    for (i, piece) in pieces.enumerate() {
      if i > 0 { link(license-url, text(fill: aik_green_ink)[#license-url]) }
      piece
    }
  }
}
