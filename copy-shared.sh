#!/bin/bash
# Copy the aikyam.space pieces this template reuses verbatim: the design
# system, the activity components, and the PDF report template.
# Usage: ./copy-shared.sh [path to an aikyam-space checkout]
set -euo pipefail
SRC=${1:-$HOME/aikyam-space}
DST=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$DST/src/styles" "$DST/src/components" "$DST/src/lib" "$DST/story" "$DST/public"
cp -R "$SRC/src/styles/." "$DST/src/styles/"
cp "$SRC/src/components/ActivityToc.astro" "$SRC/src/components/ActivityCounts.astro" "$SRC/src/components/ActivityFacilitators.astro" "$DST/src/components/"
cp "$SRC/src/lib/toc.ts" "$SRC/src/lib/blocks-to-html.ts" "$DST/src/lib/"
cp -R "$SRC/story/fonts" "$DST/story/"
cp "$SRC/story/report.typ" "$SRC/story/render-report.typ" "$SRC/story/font-coverage.json" "$DST/story/"
# tokens.mjs sits one level higher here (story/, not story/lib/), so its path
# to colors.css loses one '..'.
sed "s#path.join(here, '..', '..', 'src'#path.join(here, '..', 'src'#" "$SRC/story/lib/tokens.mjs" > "$DST/story/tokens.mjs"
grep -q "path.join(here, '..', 'src'" "$DST/story/tokens.mjs" || { echo "copy-shared: tokens.mjs path fix did not apply" >&2; exit 1; }
cp -R "$SRC/public/fonts" "$DST/public/"
echo "copied from $SRC"
