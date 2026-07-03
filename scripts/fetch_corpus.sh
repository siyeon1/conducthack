#!/usr/bin/env bash
# Fetch the IBM CBSA COBOL corpus (tag 2026Q1) into corpus/cbsa.
# Paths verified 2026-07-02: cobol_src/ (29 .cbl) + cobol_copy/ (37 .cpy).
set -euo pipefail

DEST="corpus/cbsa"
REPO="https://github.com/cicsdev/cics-banking-sample-application-cbsa"
TAG="2026Q1"

if [ -d "$DEST/src/base/cobol_src" ]; then
  echo "Corpus already present at $DEST — skipping."
  exit 0
fi

echo "Cloning CBSA $TAG into $DEST ..."
git clone --depth 1 --branch "$TAG" "$REPO" "$DEST"

progs=$(ls "$DEST"/src/base/cobol_src/*.cbl 2>/dev/null | wc -l | tr -d ' ')
cpys=$(ls "$DEST"/src/base/cobol_copy/*.cpy 2>/dev/null | wc -l | tr -d ' ')
echo "Done: $progs programs, $cpys copybooks."
