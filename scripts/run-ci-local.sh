#!/usr/bin/env bash
# Everything the workflows in .github/workflows run, in one go
set -euo pipefail
cd "$(dirname "$0")/.."

function print_heading() {
    echo
    echo "=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-="
    echo "$1 >>>"
}

print_heading "Biome"
pnpm format

print_heading "Ruff and ty"
pnpm lint:py

print_heading "tsc"
pnpm typecheck

print_heading "Build"
pnpm build
