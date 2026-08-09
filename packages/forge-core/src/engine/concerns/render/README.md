# render

Render is the last renderer-facing step. Resolve has already produced branded `RenderBlock` values; render looks
each one up in the component registry, renders any nested render blocks hidden inside block properties, calls
`renderer.renderBlock()` for the parent, then assembles the page. Renderer output is treated as `unknown` - the
engine controls order and nesting, not the output format, so an adapter can return HTML strings or anything else.

## Stage folders

- [runtime](runtime/README.md) owns the render work handlers and the `request.render` phase handler.
- `contracts` holds `renderBlock.brand.ts`, the brand that lets render spot a nested render block inside arbitrary properties.

There is no analysis or lowering folder, and there is unlikely to ever be one. Nothing about rendering is known at
compile time: the renderer and the component registry are supplied when the request is evaluated.

## Runtime phase

This concern owns `request.render`, which only runs when a renderer was supplied. Without one, `request.resolve`
is terminal and returns the `RenderContext` directly. The child work kinds are `render.render-blocks`,
`render.render-blocks.block`, and `render.assemble-page`.

## Cross-concern edges

- Render imports no other concern.
- **resolve** imports render for the render block brand.

Every other concern edge is blocked by the zones in [eslint.config.mjs](../../../../eslint.config.mjs).
