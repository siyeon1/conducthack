"""server/integrations.py — outbound workplace notifications ("works with your current workflow").

Slack delivery via an app incoming webhook (SLACK_WEBHOOK_URL in .env): no OAuth flow, no public
endpoint, Block Kit supported, link buttons work without interactivity. Four events flow out:

  * plan.approved            — programme kickoff (stages + verified/inferred edge counts)
  * stage.awaiting_approval  — a drafted change is waiting for a human (deep link, NO approve button)
  * change.recorded          — the ledger receipt: approver rationale (verbatim) + entry hash
  * ledger.verify_failed     — the tamper alarm (fires live during the tamper demo)

DELIBERATE design choice: there is no Approve button in Slack. GitHub lets you approve deployments
from chat; here an approval requires a typed justification that gets hash-chained, so Slack only
notifies and deep-links into the cockpit. Notification is cheap; accountability is not.

Delivery is fire-and-forget on a daemon thread (a chat outage must never block the cockpit), and
every message lands in an in-memory outbox exposed via GET /integrations/status — so the UI can
show an honest "delivered" vs "queued — no webhook configured" state.
"""
from __future__ import annotations

import os
import threading
from collections import deque
from datetime import datetime, timezone

APP_URL = os.getenv("APP_URL", "http://localhost:5173")

_OUTBOX: deque = deque(maxlen=25)
_LOCK = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _webhook() -> str:
    return (os.getenv("SLACK_WEBHOOK_URL") or "").strip()


def connected() -> bool:
    return bool(_webhook())


# --------------------------------------------------------------------------- #
# Block Kit builders — the industry grammar: header + field grid + excerpt +  #
# link-button action row + context footer.                                    #
# --------------------------------------------------------------------------- #

def _btn(text: str, url: str) -> dict:
    return {
        "type": "actions",
        "elements": [{"type": "button", "text": {"type": "plain_text", "text": text}, "url": url}],
    }


def _fields(pairs: list[tuple[str, str]]) -> dict:
    return {
        "type": "section",
        "fields": [{"type": "mrkdwn", "text": f"*{k}:*\n{v}"} for k, v in pairs if v],
    }


def _context(text: str) -> dict:
    return {"type": "context", "elements": [{"type": "mrkdwn", "text": text}]}


def build_message(event: str, data: dict) -> dict:
    """Return {text, blocks} for an event. `text` is the notification fallback line."""
    if event == "plan.approved":
        text = f"✅ Change programme approved: {data.get('title', '')}"
        blocks = [
            {"type": "header", "text": {"type": "plain_text", "text": "✅ Change programme approved"}},
            _fields([
                ("Change", data.get("title", "")),
                ("Stages", str(data.get("stages", "?"))),
                ("Dependencies", f"{data.get('verified_edges', 0)} verified (parsed) / {data.get('inferred_edges', 0)} inferred"),
            ]),
            _btn("Open programme", APP_URL),
            _context("Approved in the cockpit — execution of each stage is individually gated."),
        ]
    elif event == "stage.awaiting_approval":
        text = f"✋ Awaiting approval: {data.get('stage', data.get('change_request', ''))}"
        excerpt = (data.get("diff_excerpt") or "").strip()
        blocks = [
            {"type": "header", "text": {"type": "plain_text", "text": "✋ Change awaiting human approval"}},
            _fields([
                ("Change", data.get("change_request", "")),
                ("Session", str(data.get("session_id", ""))[:8]),
            ]),
        ]
        if excerpt:
            blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": f"```{excerpt[:400]}```"}})
        blocks.append(_btn("Review in cockpit", APP_URL))
        blocks.append(_context("Approval requires a typed rationale in the cockpit — by design, no one-click approve here."))
    elif event == "change.recorded":
        text = f"⛓ Change recorded to the ledger by {data.get('approver', '')}"
        rationale = (data.get("rationale") or "").strip()
        blocks = [
            {"type": "header", "text": {"type": "plain_text", "text": "⛓ Change recorded — tamper-evident"}},
            _fields([
                ("Change", data.get("intent", "")),
                ("Decision", data.get("decision", "")),
                ("Approver", data.get("approver", "")),
                ("Programs", ", ".join(data.get("programs", []) or [])),
                ("Entry hash", f"`{str(data.get('entry_hash', ''))[:12]}…`"),
            ]),
        ]
        if rationale:
            blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": f"*Justification (hash-chained):*\n_{rationale[:300]}_"}})
        blocks.append(_btn("View ledger", APP_URL))
        blocks.append(_context("This message is a receipt; the authoritative record is the hash-chained ledger."))
    elif event == "ledger.verify_failed":
        text = "🚨 Ledger integrity check FAILED"
        blocks = [
            {"type": "header", "text": {"type": "plain_text", "text": "🚨 Ledger integrity check FAILED"}},
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"Hash chain broken at entry *#{data.get('broken_at', '?')}* — a recorded entry no longer matches its hash. History has been altered.",
                },
            },
            _btn("Open verification", APP_URL),
            _context("Tamper-EVIDENT: alteration cannot be prevented, but it can never go unnoticed."),
        ]
    else:
        text = f"Legacy Move event: {event}"
        blocks = [{"type": "section", "text": {"type": "mrkdwn", "text": text}}]
    return {"text": text, "blocks": blocks}


# --------------------------------------------------------------------------- #
# Delivery + outbox                                                            #
# --------------------------------------------------------------------------- #

def _deliver(entry: dict, payload: dict, url: str) -> None:
    try:
        import httpx

        r = httpx.post(url, json=payload, timeout=5)
        with _LOCK:
            entry["status"] = "delivered" if r.status_code == 200 else f"failed ({r.status_code})"
    except Exception as exc:  # a chat outage must never break the cockpit
        with _LOCK:
            entry["status"] = f"failed ({type(exc).__name__})"


def notify(event: str, data: dict) -> dict:
    """Build the message, queue it in the outbox, and (if a webhook is configured) deliver it on
    a daemon thread. Never raises; returns the outbox entry."""
    msg = build_message(event, data or {})
    entry = {
        "event": event,
        "at": _now(),
        "text": msg["text"],
        "status": "queued — no webhook configured" if not connected() else "sending",
    }
    with _LOCK:
        _OUTBOX.appendleft(entry)
    url = _webhook()
    if url:
        threading.Thread(target=_deliver, args=(entry, msg, url), daemon=True).start()
    return entry


def get_status() -> dict:
    with _LOCK:
        outbox = list(_OUTBOX)
    return {"slack": {"connected": connected()}, "outbox": outbox}
