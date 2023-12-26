#!/usr/bin/env bash
set -eo pipefail
set -x

rm -rf public/pairs
scripts/minkowskiPairs.ts
