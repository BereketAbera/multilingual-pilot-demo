#!/usr/bin/env bash
# Rebuilds every graphic in this repository from design/make_assets.py.
# Needs Python 3 (standard library only) and Inkscape 1.4. Run from anywhere: design/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."

INKSCAPE="${INKSCAPE:-$(command -v inkscape || echo /opt/homebrew/bin/inkscape)}"
BUILD=design/build
mkdir -p "$BUILD" public src/assets/brand src/assets/diagrams docs

# 1. The SVG sources. The header's mark and the two drawings the Handoff page shows inline are used as written,
#    and go straight to src/assets.
python3 design/make_assets.py svg

# 2. The tab icon. Inkscape turns the strokes into plain filled shapes, so every renderer draws the
#    same thing; the tidy step then drops the long style Inkscape writes on each shape.
"$INKSCAPE" "$BUILD/favicon.src.svg" --actions="select-all;object-stroke-to-path" \
  --export-plain-svg --export-type=svg --export-filename="$BUILD/favicon.outlined.svg"
python3 design/make_assets.py tidy "$BUILD/favicon.outlined.svg" public/favicon.svg

# 3. The icon files browsers and phones ask for by name.
#    The 16 pixel one has its own drawing: no clear edge around the fifth stroke, which is too thin to show there.
"$INKSCAPE" "$BUILD/favicon-16.src.svg" --export-type=png --export-width=16 --export-filename="$BUILD/icon-16.png"
for size in 32 48; do
  "$INKSCAPE" public/favicon.svg --export-type=png --export-width="$size" --export-filename="$BUILD/icon-$size.png"
done
python3 design/make_assets.py ico public/favicon.ico "$BUILD/icon-16.png" "$BUILD/icon-32.png" "$BUILD/icon-48.png"
"$INKSCAPE" "$BUILD/touch-icon.src.svg" --export-type=png --export-width=180 --export-filename=public/apple-touch-icon.png

# 4. The README's figure. GitHub cannot load the app's fonts, so the diagram is drawn to a PNG here,
#    at twice its size, with the IBM Plex files the app already ships (unpacked from node_modules,
#    nothing downloaded).
python3 design/make_assets.py fonts "$BUILD/fonts"
FONTCONFIG_FILE="$PWD/$BUILD/fonts/fonts.conf" "$INKSCAPE" "$BUILD/backend-messages.src.svg" \
  --export-type=png --export-width=1728 --export-png-color-mode=RGB_8 --export-png-compression=9 \
  --export-filename=docs/backend-messages.png

ls -l public/favicon.svg public/favicon.ico public/apple-touch-icon.png src/assets/brand/mark.svg \
  src/assets/diagrams/backend-messages-wide.svg src/assets/diagrams/backend-messages-path-*.svg docs/backend-messages.png
