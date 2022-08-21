#!/bin/bash
# runs some benchmark (currently just Tribo)

cwd=${PWD}
trap 'cd "$cwd"' EXIT
cd "$cwd/benchmark"

node tribo.bench.js
node naming.bench.js

exit 0
