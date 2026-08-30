# render

Render is the last renderer-facing step. Resolve has already produced branded `RenderBlock` values; render looks
each one up in the request-owned function registry, renders any nested render blocks hidden inside block properties,
evaluates the parent, then asks the renderer to assemble the page. Presentation output is treated as `unknown` - the
engine controls evaluation, order, and nesting, not the output format, so a function can return HTML strings or anything else.

## Stage folders

- [runtime](runtime/README.md) owns the render work handlers and the `request.render` phase handler.
- `contracts` holds `renderBlock.brand.ts`, the brand that lets render spot a nested render block inside arbitrary properties.

There is no analysis or lowering folder. Compilation validates presentation-function names and static field metadata;
the page renderer and request-bound evaluators are supplied when the request is evaluated.

## Runtime phase

This concern owns `request.render`, which only runs when a renderer was supplied. Without one, `request.resolve`
is terminal and returns the `RenderContext` directly. The child work kinds are `render.render-blocks`,
`render.render-blocks.block`, and `render.assemble-page`.

## Cross-concern edges

- Render imports no other concern.
- **resolve** imports render for the render block brand.

Every other concern edge is blocked by the zones in [eslint.config.mjs](../../../../eslint.config.mjs).
