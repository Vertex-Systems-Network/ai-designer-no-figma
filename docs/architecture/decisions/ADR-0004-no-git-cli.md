# ADR-0004: No Git CLI in the engineering workflow

- **Status:** Accepted per project requirement.
- **Context:** This development environment requires direct filesystem and connected GitHub API workflows.
- **Decision:** Never invoke Git/GitHub CLI commands or scripts that call them. Use file operations, hashes and ZIPs locally; when publishing is explicitly authorized, use the connected GitHub application/API.
- **Consequences:** Do not rely on local Git status/diff, hooks, clones or Git package URLs. Audit scripts must scan shell/script content for accidental Git invocation.
- **Related modules:** `scripts/`, `tools/repository-audit/`, build/release process.
