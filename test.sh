#!/bin/sh
set -e
cd "$(dirname "$0")"
python3 -m unittest discover -s tests -q
node --test tests/test_extension.cjs tests/test_mechanisms.cjs tests/test_map.cjs
