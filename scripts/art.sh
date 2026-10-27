#!/usr/bin/env bash
# Make thumbnails next to the originals: public/art/{albums,singles}/<release-slug>.{jpg,png} -> <release-slug>.webp
# and public/art/members/<first-last>.jpg (or <name>-full.webp) -> <name>.webp
# Both are deployed; the page shows the thumbnail and links to the original.
set -euo pipefail
cd "$(dirname "$0")/.."

SIZE=400 # covers display at up to 200 CSS px, so this stays sharp on 2x screens
for src in public/art/*/*.{jpg,jpeg,png} public/art/members/*-full.webp; do
  [ -e "$src" ] || continue
  name=$(basename "${src%.*}")
  name=${name%-full}
  dest="$(dirname "$src")/$name.webp"
  if [[ $src == public/art/members/* ]]; then
    # Keep the aspect ratio, shortest side SIZE
    convert "$src" -resize "${SIZE}x${SIZE}^" -strip -quality 80 "$dest"
  else
    # Fill the square and centre-crop, so slightly off-square scans line up with the rest
    convert "$src" -resize "${SIZE}x${SIZE}^" -gravity center -extent "${SIZE}x${SIZE}" -strip -quality 80 "$dest"
  fi
  echo "$dest"
done
