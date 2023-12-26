#!/usr/bin/env bash
set -eo pipefail
set -x

./subset.py > src/safe.txt
