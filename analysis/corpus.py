"""analysis/corpus.py — M1 corpus ingestion (Claude.MD §6 M1). Track A.

Loads COBOL programs + copybooks from disk into memory. NO mainframe, NO execution —
static source only (§0 golden rule 4). Defensive: a missing directory yields an empty
corpus rather than a crash (supports the graceful-failure story, T2.4).

CBSA (tag 2026Q1) layout — paths verified on clone 2026-07-02:
    <corpus_dir>/cobol_src/*.cbl     (29 programs)
    <corpus_dir>/cobol_copy/*.cpy    (37 copybooks)   ← NOT 'copybook' (corrected §10)
`file` fields are made relative to the CBSA repo root so they read as
"src/base/cobol_src/XFRFUN.cbl" (matching citations/fixtures).
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_CORPUS_DIR = os.getenv("CORPUS_DIR", "corpus/cbsa/src/base")


@dataclass
class SourceUnit:
    name: str        # PROGRAM-ID / copybook name, upper-cased (e.g. "XFRFUN")
    file: str        # repo-relative path, forward slashes ("src/base/cobol_src/XFRFUN.cbl")
    abspath: str
    text: str
    n_lines: int
    kind: str        # "program" | "copybook"


@dataclass
class Corpus:
    corpus_dir: str
    programs: dict[str, SourceUnit] = field(default_factory=dict)
    copybooks: dict[str, SourceUnit] = field(default_factory=dict)

    @property
    def program_names(self) -> list[str]:
        return sorted(self.programs)

    @property
    def copybook_names(self) -> list[str]:
        return sorted(self.copybooks)

    def get(self, name: str) -> SourceUnit | None:
        key = (name or "").upper().strip()
        return self.programs.get(key) or self.copybooks.get(key)

    def total_lines(self) -> int:
        return sum(u.n_lines for u in self.programs.values()) + sum(
            u.n_lines for u in self.copybooks.values()
        )


def _repo_root(corpus_dir: Path) -> Path:
    # corpus_dir = <repo>/src/base  →  repo root = corpus_dir.parent.parent, so citations
    # read as "src/base/cobol_src/XFRFUN.cbl".
    if corpus_dir.name.lower() == "base" and corpus_dir.parent.name.lower() == "src":
        return corpus_dir.parent.parent
    return corpus_dir


def _load_dir(directory: Path, repo_root: Path, kind: str, exts: tuple[str, ...]) -> dict[str, SourceUnit]:
    units: dict[str, SourceUnit] = {}
    if not directory.is_dir():
        return units
    for path in sorted(directory.iterdir()):
        if path.suffix.lower() not in exts or not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        try:
            rel = path.resolve().relative_to(repo_root.resolve()).as_posix()
        except ValueError:
            rel = path.as_posix()
        name = path.stem.upper()
        units[name] = SourceUnit(
            name=name,
            file=rel,
            abspath=str(path.resolve()),
            text=text,
            n_lines=text.count("\n") + 1,
            kind=kind,
        )
    return units


def load_corpus(corpus_dir: str | None = None) -> Corpus:
    """Load programs (cobol_src/*.cbl) and copybooks (cobol_copy/*.cpy) into memory."""
    cdir = Path(corpus_dir or DEFAULT_CORPUS_DIR)
    repo_root = _repo_root(cdir)
    programs = _load_dir(cdir / "cobol_src", repo_root, "program", (".cbl", ".cob"))
    copybooks = _load_dir(cdir / "cobol_copy", repo_root, "copybook", (".cpy",))
    return Corpus(corpus_dir=str(cdir), programs=programs, copybooks=copybooks)
