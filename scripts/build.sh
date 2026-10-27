#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

python3 scripts/data/build.py
tsc

# Strip any credentials CI may have put in the remote URL
repo=$(git remote get-url origin 2>/dev/null | sed 's|//[^@/]*@|//|') || repo=local
sha=$(git rev-parse HEAD)
VITE_SOURCE="$repo @ $sha" vite build
