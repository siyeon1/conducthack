"""server/main.py — the async FastAPI app (Claude.MD §5 / §14 L3). Track B.

The graph is compiled ONCE inside the lifespan with an AsyncSqliteSaver (async-everywhere —
never mix sync/async checkpointers, L3) and stored on app.state. A per-process in-memory
session registry maps session_id → thread_id (L4).

Run:  uvicorn server.main:app --reload --port 8000
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from agent.graph import open_graph  # noqa: E402  (after load_dotenv so env is set)
from ledger.chain import get_ledger  # noqa: E402
from llm import get_provider  # noqa: E402
from server.routers import router  # noqa: E402

CHECKPOINT_DB = os.getenv("CHECKPOINT_DB", "checkpoints.sqlite")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with open_graph(CHECKPOINT_DB) as graph:
        app.state.graph = graph
        app.state.sessions = {}
        get_ledger()  # eager-init the ledger store
        prov = get_provider()
        print(f"[Legacy Move] graph compiled · provider={prov.name} · local={prov.runs_locally}")
        yield


app = FastAPI(title="Legacy Move — Change Cockpit", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev only; the frontend runs on http://localhost:5173
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health():
    prov = get_provider()
    return {"ok": True, "provider": prov.name, "runs_locally": prov.runs_locally}
