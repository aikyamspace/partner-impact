// The compile entry point: one card, from `--input` values.
//
// ⛔ --input, NOT a file named after the activity. A real published slug in
// this corpus is 255 characters long WITH SPACES, so `<slug>-<locale>.json`
// exceeds the filesystem's per-component limit and the write fails. sys.inputs
// has no such ceiling.

#import "card.typ": story-card

#let inputs = sys.inputs
#let has(k) = k in inputs and inputs.at(k) != ""

#story-card(
  photo: if has("photo") { inputs.photo } else { none },
  photo-w: if has("photo_w") { int(inputs.photo_w) } else { 0 },
  photo-h: if has("photo_h") { int(inputs.photo_h) } else { 0 },
  kicker: inputs.at("kicker", default: ""),
  title: inputs.at("title", default: ""),
  credit: inputs.at("credit", default: ""),
  site: inputs.at("site", default: "aikyam.space"),
  malayalam: inputs.at("malayalam", default: "0") == "1",
)
