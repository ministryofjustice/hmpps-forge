# diagnostics

Two small utilities that attach source location metadata to nodes and format DSL
paths for error messages.

| File | What it does |
|------|--------------|
| [`sourceMetadata.ts`](./sourceMetadata.ts) | Attaches a `DSLSourceMetadata` (the DSL path and its formatted string) to authored objects via a symbol property, so later stages can retrieve it for error reporting |
| [`formatDSLPath.ts`](./formatDSLPath.ts) | Turns a raw path segment array (e.g. `["steps", 0, "blocks", 1, "validWhen", 0]`) into a human-readable string (e.g. `step('/name').blocks[1].validWhen[0]`) by resolving structure types, step paths, and expression kinds |
