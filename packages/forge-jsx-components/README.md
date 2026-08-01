# Forge JSX Components

Write forge component renders in JSX that compiles straight to escaped HTML strings. There is no
React, no virtual DOM and no framework at runtime - the JSX transform rewrites your markup into
calls to this package's own string-building runtime, so a component written this way registers and
renders exactly like any other string-producing component.

Everything in this package is experimental. It may change or be removed in a minor release.

## Why JSX instead of string building?

A `component()` render built from template literals has to remember to escape every interpolated
value itself, and the markup structure disappears into string concatenation. A Nunjucks wrapper
avoids that but drags a renderer environment along with it.

JSX gives you the markup as markup - checked by the compiler against typed element and attribute
definitions - with escaping applied by default to everything interpolated. The trade is an extra
compile step for `.tsx` files, plus the experimental caveat above.

## How it works

TypeScript's automatic JSX transform rewrites `<div class="x">{y}</div>` into calls to the `jsx()`
and `jsxs()` functions in this package's runtime. Every JSX expression evaluates to a `RawHtml` - a
string of HTML that is already safe to embed - and any value interpolated into it is entity-escaped
on the way in unless it is itself a `RawHtml`.

All of this happens at build time. Components built with this package ship as plain compiled
JavaScript, so nothing downstream needs to know JSX was involved.

## Writing a component

`jsxComponent()` is `component()` with the render output pinned to the runtime's `RawHtml` and
stringified at the boundary. Unlike `nunjucksComponent` there is no renderer argument - JSX compiles
to direct string building, so there is no environment to inject.

```tsx
import type { BlockDefinition, ResolvableString } from '@ministryofjustice/hmpps-forge/core/components'
import { jsxComponent } from '@ministryofjustice/hmpps-forge/jsx-components'

export interface MyBadge extends BlockDefinition {
  text: ResolvableString
}

export const MyBadge = jsxComponent<MyBadge>('myBadge', {
  render: props => <strong class="moj-badge">{props.text}</strong>,
})
```

The result is an ordinary `ForgeComponent` producing plain HTML strings - register it and use it in
journeys exactly as you would any other component.

## Project setup

To author components in JSX, point TypeScript's automatic transform at this package and use `.tsx`
file extensions:

```jsonc
// tsconfig.json
"jsx": "react-jsx",
"jsxImportSource": "@ministryofjustice/hmpps-forge/jsx-components"
```

Any build tool that understands the automatic transform (tsc, esbuild, Vite, swc) will work -
dev-mode transforms are covered too, as the package's `jsx-dev-runtime` subpath resolves to the same
runtime.

This setup is only for authoring. Consuming components that happen to be built with JSX needs none
of it - they arrive as compiled JavaScript with ordinary string-typed declarations.

One constraint to know about: `jsxImportSource` applies per file scope, so a project that also uses
React for its own JSX needs to keep the two apart - either with separate `tsconfig` scopes or a
`/** @jsxImportSource @ministryofjustice/hmpps-forge/jsx-components */` pragma at the top of the
forge component files.

## Escaping and raw HTML

Everything interpolated into JSX is escaped by default - `{userInput}` renders `<script>` as
`&lt;script&gt;`. Attribute values are escaped the same way.

`raw()` marks trusted markup as safe to embed verbatim:

```tsx
<div class="card__body">{raw(renderedChildBlock.html)}</div>
```

Reach for `raw()` only for HTML that has already been rendered safely - the output of another
component, for instance. Wrapping anything user-influenced in `raw()` reopens the injection hole the
runtime exists to close.

A few serialisation rules worth knowing:

- `null`, `undefined` and booleans render as nothing, so `{condition && <p>...</p>}` works
- attributes set to `true` render as bare attributes (`disabled`), and `false`/`null`/`undefined`
  attributes are omitted entirely
- void elements (`br`, `img`, `input` and friends) render without a closing tag and ignore children
- fragments (`<>...</>`) render their children with no wrapping element

## Supported elements and attributes

Element and attribute typings are vendored from hono/jsx (which bases them on React's), trimmed for
server-side string rendering - event handlers, `dangerouslySetInnerHTML` and DOM-only types are
removed, and `style` accepts only a string. Attributes use their HTML names: `class`, not
`className`.

The known attributes are typed with their allowed values, and unknown attributes (`data-*` and
friends) are accepted on any element. See
[`intrinsicElements.type.ts`](src/runtime/types/intrinsicElements.type.ts) for the full surface.

## Stability

This package is the experimental half of an open question - whether JSX is a better way to author
forge components than string building. The API may change or be removed in a minor release, so pin
expectations accordingly, and raise an issue or talk to the forge team if you try it and have
opinions either way.
