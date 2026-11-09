# Development roadmap

This file is a short navigation page. The executable, evidence-based plan is [`EXECUTION-PLAN.md`](EXECUTION-PLAN.md); the feature registry is the source of truth for what exists, and [`AI-HANDOFF.md`](AI-HANDOFF.md) records the latest verified checkpoint.

## Delivery order

1. **Close local code gates:** work the `CODE-*` tasks in the execution plan, starting with behavioral host tests and lossless export/import gaps. Keep each change small enough to verify in one iteration.
2. **Validate with real clients:** when the user's Figma/Claude/Ollama environment is available, complete the listed `LIVE-*` checks and record evidence. A mock or source inspection cannot close these gates.
3. **Package a release candidate:** run `npm run release:verify`, inspect generated checksums, package the exact source tested, and update repository docs and artifact together.
4. **Close or explicitly defer external boundaries:** `BLOCK-*` items cannot be marked done through plugin code alone. Implement a separate supported desktop runner only after that capability is available and independently tested.

## Progress rules

- No overall completion percentage is published. It conflates source implementation with unavailable live checks.
- A progress bar is allowed only when it is computed from named, checked acceptance items in the execution plan. Unknown or blocked items stay open; estimates do not count as progress.
- Every completed task links to code plus an exact command result or a user-confirmed live observation.
- The README tracker, this roadmap, feature registry, status and handoff must agree before packaging.

## Current release posture

Automated release verification is available and has passed in the recorded checkpoint. Live Figma renderer, pairing, visual review, real local-model and cross-client checks remain separate. See the execution plan for the current status and next task; do not infer 100% completion from a successful build.
