"""scripts/drive.py — end-to-end HTTP self-test for the shft MVP.

Runs the full overdraft flow N times against a running server (default 2 = the twice-cold DoD):
  Locate → Explain → Impact → Propose ─[approve]─ Record → Ledger verify → Tamper → Verify(fail)

Usage:  python scripts/drive.py [N]      (server must be running on :8000)
"""
import sys

import httpx

BASE = "http://localhost:8000"
REQ = "Cap / add a compliant guard on overdraft fees to comply with FCA Consumer Duty"


def run_once(run_no: int, c: httpx.Client) -> None:
    print(f"\n===== RUN {run_no} =====")
    sid = c.post(f"{BASE}/session", json={"change_request": REQ}).json()["session_id"]
    print("session:", sid[:8])

    st = c.post(f"{BASE}/cell/run", json={"session_id": sid, "cell": "locate"}).json()["state"]
    progs = [p["program"] for p in st["cells"]["locate"]["payload"]["programs"]]
    print("LOCATE:", st["cells"]["locate"]["status"], "| intent:", st["intent"], "| programs:", progs)

    st = c.post(f"{BASE}/cell/run", json={"session_id": sid, "cell": "explain", "selected_program": "XFRFUN"}).json()["state"]
    print("EXPLAIN:", st["cells"]["explain"]["status"], "| idioms:", len(st["cells"]["explain"]["payload"].get("cobol_idioms", [])))

    st = c.post(f"{BASE}/cell/run", json={"session_id": sid, "cell": "impact"}).json()["state"]
    print("IMPACT:", st["cells"]["impact"]["status"], "| graph:", len(st["graph"]["nodes"]), "nodes", len(st["graph"]["edges"]), "edges")

    st = c.post(f"{BASE}/cell/run", json={"session_id": sid, "cell": "propose"}).json()["state"]
    pc = st["cells"]["propose"]
    print("PROPOSE:", pc["status"], "| diff chars:", len(pc.get("proposed_diff") or ""))
    assert pc["status"] == "awaiting_approval" and (pc.get("proposed_diff") or ""), "propose must gate with a diff"

    approve_body = {
        "session_id": sid,
        "decision": "approve",
        "rationale": "Guard mirrors the existing MORTGAGE/LOAN pattern; localized to the debit side; no copybook or interface change.",
    }
    st = c.post(f"{BASE}/cell/approve", json=approve_body).json()["state"]
    print("RECORD:", st["cells"]["record"]["status"], "| ledger_head:", (st.get("ledger_head") or "")[:12])
    assert st["cells"]["record"]["status"] == "done"

    led = c.get(f"{BASE}/ledger", params={"session_id": sid}).json()
    print("LEDGER:", len(led["entries"]), "entry, verified:", led["verified"])
    assert led["verified"] is True

    c.post(f"{BASE}/ledger/tamper", json={"session_id": sid})
    v2 = c.post(f"{BASE}/ledger/verify", json={"session_id": sid}).json()
    print("VERIFY after tamper:", v2)
    assert v2["verified"] is False and v2.get("broken_at") == 0


def main() -> None:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    with httpx.Client(timeout=60) as c:
        for i in range(1, n + 1):
            run_once(i, c)
    print("\n*** ALL RUNS PASSED (twice-cold DoD) ***")


if __name__ == "__main__":
    main()
