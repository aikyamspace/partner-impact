// One activity's shareable card — 1080x1920, for WhatsApp status and
// Instagram stories. Compiled at --ppi 72 from a 1080pt x 1920pt page, so the
// pt figures below ARE pixels.
//
// Every decision here was the owner's, 16 Sep 2026; the plan records each one
// with the measurement behind it. The ones a later change could quietly undo:
//
// ⛔⛔ THE PHOTO BAND IS A 1080 SQUARE AND IS ALWAYS FULL — owner's ruling,
// 17 Sep 2026, and it REVERSES his own rule of 16 Sep that no photograph is
// ever enlarged. The reason for the reversal is the card's job: someone crops
// it to 1:1 for an Instagram post, and a square that is part photograph and
// part ink is not a post. So the square is filled, and 178 of 252 photographs
// are enlarged to fill it — median x1.34, worst x4.50 on a 482x240 original.
// He was shown those numbers and chose this.
// ⛔ THE REVERSAL IS THE CARD'S ALONE. The activity PAGE still shows every
// photograph whole, uncropped and unenlarged (ActivityPhoto.astro), and the
// record PDF crops but never enlarges. Do not carry this rule to either.
// ⚠️ The fetch still sends `withoutEnlargement=true` — enlarging is this
// template's decision, made in the open here, not something a URL does behind
// it. What the fetch now guarantees is 1080 on the photo's SHORT edge
// (`fit=outside`), so the square is filled from real pixels wherever the
// original has them.
//
// ⛔ NO `size-adjust` (§1h). The site applies 90% to Noto Sans Malayalam so
// both scripts look the same size on a mixed line; Typst has no equivalent and
// the owner chose nominal sizes rather than hand-scaling. So Malayalam here
// runs about 11% larger than the same declared size on the site. That is a
// deliberate divergence. Do not "fix" it by multiplying by 0.9.
//
// ⛔ NO WORDMARK, NO CLASP MARK, NO WHATSAPP OR INSTAGRAM LOGO. Owner's call
// for the first two; Meta's brand guidelines for the third, which forbid
// combining their marks with other marks and forbid implying an integration.
// The URL is the only branding.
//
// The colours come from tokens.typ, generated from the design system's own
// colors.css. Never write a hex into this file.

#import "tokens.typ": *

// ⛔ The photo band is a fixed square, so a 1:1 crop of the finished card is
// always a whole photograph. It is also exactly half the card's height, which
// is what leaves the words a predictable 840pt.
#let SQUARE = 1080pt
// ⛔⛔ WHERE A TOO-TALL PHOTO IS CROPPED FROM — 0 is the top edge, 0.5 centres,
// 1 is the bottom. This is the page hero's `object-position: 50% 35%` with no
// CSS to express it in, and it exists for one reason: heads sit in the upper
// half of a candid phone photograph, so a CENTRED crop decapitates people.
// ActivityHero.astro's own comment says the same thing about the same photos.
// ⚠️ 23 cards are cropped by the band today. A centred crop shipped on 16 Sep
// 2026 and cut a child's head off the top of the air-pressure card; what this
// loses instead is floor and ceiling, which nobody came to see.
#let PHOTO_FOCUS = 0.35
#let PAD = 88pt
#let CARD_W = 1080pt
#let CARD_H = 1920pt

// ⭐ The headline fits itself. Malayalam titles run to 115 characters against
// English's 78, so a fixed size spills off the card on about a third of the
// Malayalam ones. Typst has no "shrink to fit", so this is measure() in a
// loop — the browser's scrollHeight/clientHeight step, expressed the Typst way.
// ⛔ The failure is a PANIC, not a clipped card: panic() inside context exits 1
// with its message, and Typst writes nothing to stdout that a caller could
// inspect instead. A card that cannot be made right must stop the build.
// ⛔⛔ `top-edge: "cap-height"` / `bottom-edge: "baseline"` is not decoration —
// without it this headline is unreadable. Typst's `leading` is the GAP BETWEEN
// LINES, measured from the font's own ascender to the next line's descender,
// where CSS `line-height` is the whole line box. Translating the design's
// `line-height: 1.08` into `leading: 0.08em` set the gap to almost nothing and
// the descenders of one line struck the ascenders of the next. Pinning both
// edges makes the line box exactly cap-height-to-baseline, so `leading` becomes
// the real, predictable space between lines and these numbers mean what the
// design meant.
#let fitted-headline(body, start, floor, box-w, box-h, leading, tracking, ink) = context {
  let size = start
  let render(s) = text(
    size: s, weight: 600, tracking: tracking, fill: ink,
    top-edge: "cap-height", bottom-edge: "baseline",
  )[
    #par(leading: leading, justify: false)[#body]
  ]
  while size > floor and measure(width: box-w, render(size)).height > box-h {
    size = size - 4pt
  }
  // ⛔ "still too tall AT the floor", not "reached the floor" — a title that
  // fits exactly at the floor is a good card, not a failure.
  if measure(width: box-w, render(size)).height > box-h {
    // ⛔⛔ `repr`, NOT `str` — and this line was BROKEN until 17 Sep 2026.
    // Typst's `str()` refuses a `length`, so the moment a real headline failed
    // to fit, the panic that was supposed to name the offending title died
    // with `expected integer, float, ... found length` instead. The build
    // still stopped, which is the part that mattered, but the message — the
    // whole reason the panic exists — never arrived. Found by feeding a
    // deliberately unfittable title through, which is the only way to reach
    // this line: measured across all 1012 real titles, none does.
    panic("headline does not fit at " + repr(floor) + ": " + body)
  }
  render(size)
}

#let story-card(
  photo: none, // path, or none for the sunk-paper state
  photo-w: 0,
  photo-h: 0,
  kicker: "",
  title: "",
  site: "aikyam.space", // the address in the footer
  credit: "", // the whole "At X, run by Y" line, already assembled
  malayalam: false,
) = {
  let face = ("Figtree", "Noto Sans Malayalam")
  // With the line box pinned to cap-height (see fitted-headline), these are the
  // real gaps between lines. Malayalam needs more: its vowel signs and
  // conjuncts reach well above and below the Latin cap band, so the same gap
  // that looks tight-and-deliberate in Figtree looks collided in Noto.
  let head-leading = if malayalam { 0.52em } else { 0.38em }
  // ⛔ No negative tracking on Malayalam: it collapses conjuncts.
  let head-tracking = if malayalam { 0pt } else { -0.01em }

  // ⭐⭐ TWO GROUNDS, and the second is a real row in the corpus rather than a
  // defensive branch: exactly ONE published activity has no photograph
  // (a-fee-paying-dance-class-started-with-the-students). It gets sunk paper
  // and ink text — the same ruling ActivityHero.astro's third state carries,
  // made by the owner on 14 Sep 2026 from three grounds built side by side.
  // ⛔ NO PLACEHOLDER IMAGE, ever. The ground carries the headline.
  let has-photo = photo != none
  let ground = if has-photo { aik_ink } else { aik_paper_sunk }
  let ink = if has-photo { aik_paper } else { aik_ink }
  let quiet = if has-photo { aik_mint } else { aik_ink_quiet }
  let rule-stroke = if has-photo { 2pt + aik_paper.transparentize(75%) } else { 1pt + aik_rule }
  // A card with no photograph has the whole height for its words, so it opens
  // larger — the same reasoning as the page hero's flat state.
  let head-size = if has-photo { if malayalam { 80pt } else { 88pt } } else { 96pt }

  // ⭐ COVER SCALE: the photo is grown until its SHORT side reaches the square,
  // so the square is full and the overflow spills off one axis. That overflow
  // is what `move()` below then positions.
  // ⛔ Computed HERE, not inside the branch, because the headline's own box is
  // what is left after the band — see `head-box`. A card with no photograph has
  // no band at all and the words get the whole height.
  let scale = if has-photo {
    calc.max(SQUARE / (photo-w * 1pt), SQUARE / (photo-h * 1pt))
  } else { 0.0 }
  let shown-w = if has-photo { photo-w * 1pt * scale } else { 0pt }
  let shown-h = if has-photo { photo-h * 1pt * scale } else { 0pt }
  let band = if has-photo { SQUARE } else { 0pt }

  set page(width: CARD_W, height: CARD_H, margin: 0pt, fill: ground)
  set text(font: face, fill: ink)

  if has-photo {

    // ⛔⛔ THE CROP FAVOURS THE TOP, AND THIS IS NOT A PREFERENCE. A centred
    // crop takes the head off a candid photograph: these are phone shots of
    // people in a room, and heads sit in the upper half of the frame. The page
    // hero solves it with `object-position: 50% 35%` (ActivityHero.astro, whose
    // own comment records that `50% 50%` "decapitates them"); Typst has no
    // equivalent property, so the same rule is expressed as an offset here.
    // ⚠️ SHIPPED WRONG ONCE, 16 Sep 2026 — `align(center + horizon)` cut a
    // child's head off the top of `children-learned-how-air-pressure-works`
    // and 22 other clipped cards. What is lost instead is floor and ceiling.
    // ⛔⛔ BOTH DIMENSIONS ARE GIVEN, AND THAT IS WHAT MAKES THE CROP WORK.
    // `image()` defaults to `fit: "cover"`, so an image handed only a width
    // inside a shorter box is centre-cropped by Typst BEFORE anything here can
    // position it — exactly what shipped on 16 Sep 2026, with an
    // `align(center + horizon)` that did nothing at all. Passing the real
    // scaled height makes it a genuine oversized block that `move` can slide.
    // ⚠️ Nothing is stretched: both come from one `scale`, so the photo keeps
    // its own ratio.
    let over-y = calc.max(0pt, shown-h - SQUARE)
    let over-x = calc.max(0pt, shown-w - SQUARE)
    place(top + left, box(width: CARD_W, height: band, clip: true,
      move(
        // ⛔ Vertical: the crop favours the TOP (PHOTO_FOCUS), because heads sit
        // in the upper half of a candid photograph. ⚠️ THIS NOW MATTERS FAR MORE
        // THAN IT DID: 220 of 252 photographs are landscape and crop vertically
        // for the FIRST TIME under a square band — the decapitation the constant
        // guards against used to reach 23 cards and now reaches most of them.
        dy: -over-y * PHOTO_FOCUS,
        // Horizontal: centred. A wide photo loses equal slivers of left and
        // right, and nothing about a candid shot favours one side.
        dx: -over-x * 0.5,
        image(photo, width: shown-w, height: shown-h),
      ),
    ))
    // ⛔ NO SCRIM. There was a photo-to-ground gradient here and the owner asked
    // for none — and with the square ending in a hard edge at y=1080 and every
    // word below it on ink, it has no job left. It was also the stated reason
    // the page's own hero asked Directus for quality 50; that justification is
    // gone with it.
  }

  // The words, flush to the foot, in the 840pt the square leaves.
  // ⛔⛔ THE TAIL IS MEASURED, NOT ASSUMED. This used to subtract a 344pt
  // constant that budgeted ONE LINE for the credit — and a real two-host credit
  // measures 78pt at this width, 41pt more than budgeted. The variable band
  // used to absorb that; a fixed square has NO slack, so the block would grow
  // upward and put the kicker inside the photograph — inside the very square a
  // reader is about to crop. Measuring the tail makes that arithmetically
  // impossible rather than merely unlikely.
  let box-w = CARD_W - PAD * 2

  // The date above the headline, and everything below it, as values — so they
  // can be MEASURED before the headline is asked to fit in what is left.
  let date-row = [
    #text(size: 34pt, weight: 500, tracking: 0.04em, fill: quiet)[#kicker]
    #v(28pt)
  ]
  let tail = [
    #text(size: 38pt, fill: quiet)[#credit]
    #v(48pt)
    #line(length: 100%, stroke: rule-stroke)
    #v(36pt)
    #text(size: 34pt, weight: 500, tracking: 0.02em)[#site]
  ]

  context {
    // ⛔⛔ THE CREDIT LINE IS NOT ONE LINE. "Run by aikyam space" measures 27pt;
    // "At aikyam space, run by Make A Difference and Thudippu Dance Foundation"
    // measures 78pt, and its Malayalam twin 79pt. The constant this replaced
    // budgeted 38pt, so a two-host card overran by 41pt with nowhere to put it.
    let tail-h = measure(width: box-w, tail).height
    let date-h = measure(width: box-w, date-row).height
    // 36pt is the gap under the headline block below.
    let head-box = CARD_H - band - PAD - date-h - tail-h - 36pt

    place(bottom + left, block(width: CARD_W, inset: (x: PAD, bottom: PAD))[
      #date-row
      #block(below: 36pt)[
        #fitted-headline(title, head-size, 56pt, box-w, head-box, head-leading,
          head-tracking, ink)
      ]
      #tail
    ])
  }
}
