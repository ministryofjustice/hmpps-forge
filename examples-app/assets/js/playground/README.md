# Markdown playgrounds

The Patterns section starts at `/forge-guide-v2/patterns/branching`. Each page owns its playground configuration; there is no central demo registry or standalone editor page.

Use the existing Markdown container syntax:

```md
:::playground
---
title: Branching
base: /assets/playground/branching/
entry: journey.ts
start: /branching/overview
---
journey.ts
effects.ts
visit-type/step.ts
:::
```

List every required source file, in tab order. The example above is shortened. Paths are relative to `base`, and the entry must be listed. Source files live in `assets/playground/` and are served directly as plain-text `.ts` files. The production image includes that directory unchanged. Test and declaration files are not publicly served.

The Markdown extension emits a `script[type="application/json"][data-playground]` containing settings and filenames only. The lightweight page initializer creates a container, fetches the source text and imports the editor module and stylesheet once. Pages without playgrounds do not load Monaco. Multiple instances use separate model paths and iframe sessions, sharing TypeScript initialization.

`mountPlayground(element, { title, entryFile, startPath, files })` receives a filename-to-source-text map. Monaco checks and emits all files on Run. The entry module exports the Forge package as default and can export `dependencies`. The preview supports relative imports and Forge authoring/GOV.UK component imports. The branching example injects an asynchronous in-memory answer store, separate from session drafts.

Reset restores the fetched source; edits never modify public assets. Running or restarting creates a new preview and session. Refresh loses edits. There is no npm installation, saved-edit persistence or mobile layout.

The preview endpoint retains its opaque-origin sandbox, strict CSP, embedded fonts and validated messages. Dynamic evaluation happens inside that iframe. This is not a hostile-code hosting boundary: arbitrary source can consume CPU or memory, and the iframe can navigate itself.
