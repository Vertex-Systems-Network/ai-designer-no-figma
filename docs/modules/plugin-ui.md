# Plugin UI module

- **Purpose:** React panel for generation, user-operated AI handoff, Edit, Design System, Import/Export, History, Settings, theme and resize.
- **Source:** `src/ui/main.tsx`, `src/ui/styles.css`, `src/ui/index.html`, `src/ui/assets/vsn-logo.png`.
- **Public contracts:** `HostToUi`/`UiToHost` from `src/shared/protocol.ts`.
- **Dependencies:** React/React DOM; parent Figma plugin message channel; optional local runtime.
- **Persistence:** localStorage for theme, prompt history, tokens and preferences; failure does not block session.
- **Security:** pasted files/specs validated; no remote assets; external AI prompt copy is user-initiated.
- **Status:** implemented workflows, but complete design-system controls, accessibility and screenshot QA remain.
- **Tests:** prompt/patch unit coverage and plugin build; no UI screenshot harness.
- **Known limits:** no live agent panel; export/undo controls added recently and need Figma confirmation.
