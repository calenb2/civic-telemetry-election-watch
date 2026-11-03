"""Verify the hash chain of ledger/editions.jsonl (stdlib only). Exit 0 if valid.
Each entry's entry_hash = sha256(canonical JSON of the entry without entry_hash); each
entry's prev_hash must equal the previous entry_hash; the first prev_hash is 64 zeros."""
import hashlib, json, sys
from pathlib import Path
LEDGER = Path(__file__).resolve().parent.parent / "ledger" / "editions.jsonl"
def canonical(o): return json.dumps(o, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()
prev, n = "0" * 64, 0
for line in LEDGER.read_text().splitlines():
    if not line.strip(): continue
    e = json.loads(line)
    if e["prev_hash"] != prev or hashlib.sha256(canonical({k: v for k, v in e.items() if k != "entry_hash"})).hexdigest() != e["entry_hash"]:
        print(f"ledger: BROKEN at seq {e.get('seq')}"); sys.exit(1)
    prev, n = e["entry_hash"], n + 1
print(f"ledger: VALID ({n} entries, head {prev[:16]})")
