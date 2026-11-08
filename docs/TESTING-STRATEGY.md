# Testing strategy

| Layer | Existing evidence | Still required |
|---|---|---|
| Shared spec and patch validation | Vitest deterministic valid/invalid fixtures | Schema migration and expanded design features |
| Ollama companion HTTP | Integration tests with a local fake Ollama server | Actual Ollama runtime/model, explicitly marked live |
| Figma host renderer and adapter | Typecheck/build; user previously inserted supported design layers | Official Plugin API mocks, renderer failure/rollback tests and live Figma smoke |
| Selection edits/export/undo | Validation tests and build; user live-checks loader only | Live target matching, undo and unaffected sibling verification; selected-export round trip |
| MCP | No server yet | SDK initialization, tool list/call, validation, timeout, cancellation and stdio cleanliness |
| Local bridge | No bridge yet | Pairing, correlation, unauthorized/replay rejection, queue bounds, reconnect/disconnect/cancel |
| Repository knowledge | Instructions/docs added | Scripted links, source/test references, registry statuses and generated inventory validation |

When claiming verification, name the exact command, number of passing tests and whether the service was a mock, local runtime, or live Figma session.
