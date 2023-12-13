#!/usr/bin/env bash
set -eo pipefail
set -x

rm -rf pairs
bun minkowskiPairs.ts
