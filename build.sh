#!/usr/bin/env bash
set -eo pipefail
set -x

rm -rf svgs
scripts/latexToSVG.ts

scripts/parseSVG.ts

scripts/polygonize.ts

rm -rf polygons
scripts/cgalize.ts

make
