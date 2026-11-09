# Engineering backlog

[`EXECUTION-PLAN.md`](EXECUTION-PLAN.md) is the sole ordered task board. This file groups its IDs for navigation; it does not keep a second estimate or duplicate exit criteria.

| Group | Task IDs | Current state |
|---|---|---|
| Plan/prompt coherence | `PLAN-01` | AUTOMATED VERIFIED; canonical plan/prompt, synchronized agent rules and acceptance docs; strict docs audit passed with 0 findings. |
| Local code work | `CODE-01`–`CODE-03` | `CODE-01` AUTOMATED VERIFIED; `CODE-02` IN PROGRESS (4/5 criteria; the field-by-field schema matrix remains); `CODE-03` follows after export fidelity. |
| Live acceptance | `LIVE-01`–`LIVE-04` | BLOCKED on the user's Figma/client/model environment; run each only on the current package and record exact evidence. |
| Publication | `PUB-01` | LIVE VERIFIED; uploaded ZIP blob matches local archive bytes and SHA-256 manifest. |
| External desktop boundary | `BLOCK-01`–`BLOCK-02` | Outside plugin-only scope; requires a supported app-specific desktop/client capability. |

## Last recorded automated release check

`npm run release:verify` passed with 105 unit tests, 17 integration tests, typecheck, lint, local security/privacy audit, production build/package, strict documentation audit (0 findings), ZIP integrity, and SHA-256. Re-run after any repository edits. This is not live Figma/Claude/Ollama evidence.
