#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

version=$(grep '"version"' manifest.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')
outdir="web-ext-artifacts"
outfile="$outdir/claude2md-${version}.zip"

mkdir -p "$outdir"
rm -f "$outfile"

if command -v zip &>/dev/null; then
  zip -r "$outfile" \
    manifest.json \
    content/ \
    popup/ \
    lib/ \
    icons/ \
    -x '*/.*'
elif command -v 7z &>/dev/null; then
  7z a -tzip "$outfile" \
    manifest.json \
    content/ \
    popup/ \
    lib/ \
    icons/ \
    -x'!*/.*'
else
  echo "Error: zip or 7z required" >&2
  exit 1
fi

echo "$outfile"
