"""COBOL analysis — the deterministic dependency-graph spine (Track A, §5/§8.6)."""
from analysis.cobol import build_dependency_graph, graph_from_corpus, subgraph_for
from analysis.corpus import Corpus, load_corpus

__all__ = [
    "build_dependency_graph",
    "graph_from_corpus",
    "subgraph_for",
    "Corpus",
    "load_corpus",
]
