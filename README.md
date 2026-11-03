# Civic Telemetry — Texas Election Watch editions

The public record of every edition published to **civictelemetry.org**: the snapshot each
edition rendered, its report and image, the validation verdicts it passed, and a
hash-chained ledger of publications. Verify it yourself:

```
python3 tools/verify_ledger.py
```

```
editions/<version>/   snapshot.json · notes.md · snapshot.png · manifest.json · validation.json
ledger/editions.jsonl hash-chained publication ledger (append-only; CI-enforced)
public/               the static tree exactly as served by the origin for the current edition
sources/register.csv  every source URL the current edition cites
site/                 dashboard front end, with per-file SHA-256 manifest (SOURCE-CAPTURE.md)
```

`<version>` is the SHA-256 of the edition's canonical snapshot JSON (before `snapshot_version`
is stamped), so the archive directory, the dashboard's `?version=` links and
`/api/refresh-status` agree by construction. Editions are never modified after publication;
corrections are new editions that cite the superseded version in their manifest.

Licensing: editions and ledger CC BY 4.0; dashboard source © OrbitWorks Labs LLC — see LICENSE.
Not official election results. See the disclaimer in LICENSE.

## Branch protection and the release flow

`main` is protected by the `protect-main` ruleset: deletions restricted, force-pushes blocked, and the
`verify` status check (hash chain + append-only) must pass. New editions are pushed to a branch first;
once `verify` passes on that commit, the same commit is fast-forwarded to `main`. The origin host releases
only from `main`, after re-verifying the ledger and the edition manifest hashes.
