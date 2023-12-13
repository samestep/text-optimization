#!/usr/bin/env bash
set -eo pipefail
set -x

rm -rf svgs
bun latexToSVG.ts

bun parseSVG.ts

bun polygonize.ts

rm -rf polygons
bun cgalize.ts

make
