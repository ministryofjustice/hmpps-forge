/**
 * The forge JSX runtime - compiles JSX straight to escaped HTML strings, with no
 * framework underneath.
 *
 * TypeScript's automatic JSX transform (`"jsx": "react-jsx"` with `"jsxImportSource"`
 * pointing at this package) rewrites `<div class="x">{y}</div>` into calls to the
 * `jsx`/`jsxs` functions in this module, so this file's name and export names are a
 * compiler contract, not a style choice.
 *
 * @experimental Part of the experimental JSX component API - may change or be removed
 * in a minor release.
 */
import type { IntrinsicElementAttributes } from './types/intrinsicElements.type'

/**
 * Elements with no closing tag, per the HTML spec - rendered as `<tag>` with
 * children ignored.
 */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
])

const HTML_ENTITY_MAP: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#39;',
}

const escapeHtmlEntities = (value: string): string => value.replace(/[<>&"']/g, char => HTML_ENTITY_MAP[char])

/**
 * Identifies `RawHtml` across bundle copies of this module - `Symbol.for` keys into the
 * global symbol registry, so the check holds even when two entrypoints each bundle
 * their own copy of the class.
 */
const RAW_HTML_BRAND = Symbol.for('forge.jsx.rawHtml')

/**
 * A string of HTML that is already safe to embed - the serializer includes it verbatim
 * instead of escaping it. Every JSX expression evaluates to one of these.
 *
 * @experimental Part of the experimental JSX component API - may change or be removed
 * in a minor release.
 */
export class RawHtml {
  readonly [RAW_HTML_BRAND] = true

  constructor(readonly html: string) {}

  toString(): string {
    return this.html
  }
}

const isRawHtml = (value: unknown): value is RawHtml =>
  typeof value === 'object' && value !== null && RAW_HTML_BRAND in value

/**
 * Marks trusted markup as safe to embed without escaping - the HTML of an
 * already-rendered child block, for instance. Everything not wrapped in `raw()`
 * is escaped.
 *
 * @experimental Part of the experimental JSX component API - may change or be removed
 * in a minor release.
 *
 * @example
 * ```tsx
 * <div class="card__body">{raw(renderedChildBlock.html)}</div>
 * ```
 */
export const raw = (html: string): RawHtml => new RawHtml(html)

/**
 * Anything a JSX expression can nest inside an element. Strings and numbers are
 * escaped, `RawHtml` is embedded verbatim, and `null`/`undefined`/booleans render
 * as nothing (so `{condition && <p>...</p>}` works).
 */
export type JsxChild = string | number | boolean | null | undefined | RawHtml | JsxChild[]

/**
 * The props a JSX element receives: attributes plus the nested children. The
 * automatic transform passes children inside props rather than as extra arguments.
 */
export interface JsxProps {
  children?: JsxChild
  [attribute: string]: unknown
}

type FunctionComponent = (props: JsxProps) => RawHtml

const serializeChildren = (child: JsxChild): string => {
  if (child === null || child === undefined || typeof child === 'boolean') {
    return ''
  }

  if (Array.isArray(child)) {
    return child.map(serializeChildren).join('')
  }

  if (isRawHtml(child)) {
    return child.html
  }

  return escapeHtmlEntities(String(child))
}

const serializeAttributes = (props: JsxProps): string =>
  Object.entries(props)
    .filter(([name, value]) => name !== 'children' && value !== undefined && value !== null && value !== false)
    .map(([name, value]) =>
      value === true
        ? ` ${escapeHtmlEntities(name)}`
        : ` ${escapeHtmlEntities(name)}="${escapeHtmlEntities(String(value))}"`,
    )
    .join('')

/**
 * The automatic JSX transform's element factory - `<div class="x">{y}</div>` compiles
 * to `jsx('div', { class: 'x', children: y })`. Not called directly from user code.
 *
 * The transform passes JSX `key` attributes as a third argument; keys are meaningless
 * when rendering to a string, so the extra argument is ignored.
 *
 * @experimental Part of the experimental JSX component API - may change or be removed
 * in a minor release.
 */
export const jsx = (tag: string | FunctionComponent, props: JsxProps): RawHtml => {
  if (typeof tag === 'function') {
    return tag(props)
  }

  const attributes = serializeAttributes(props)

  if (VOID_ELEMENTS.has(tag)) {
    return new RawHtml(`<${tag}${attributes}>`)
  }

  return new RawHtml(`<${tag}${attributes}>${serializeChildren(props.children)}</${tag}>`)
}

/**
 * The transform calls `jsxs` instead of `jsx` when an element has multiple static
 * children - the distinction only matters to frameworks that key children, so both
 * share one implementation here.
 *
 * @experimental Part of the experimental JSX component API - may change or be removed
 * in a minor release.
 */
export const jsxs = jsx

/**
 * Renders fragment children (`<>...</>`) with no wrapping element.
 *
 * @experimental Part of the experimental JSX component API - may change or be removed
 * in a minor release.
 */
export const Fragment = (props: JsxProps): RawHtml => new RawHtml(serializeChildren(props.children))

/**
 * Development-mode entry point - dev transforms (Vite, esbuild with jsxDev,
 * TypeScript's "react-jsxdev") import `<jsxImportSource>/jsx-dev-runtime` and call
 * `jsxDEV` instead of `jsx`/`jsxs`. Its extra arguments (key, static-children flag,
 * source location) only matter to frameworks that diff and re-render, so it is the
 * production implementation under the dev name - the package's `jsx-dev-runtime`
 * subpath resolves to this same module.
 *
 * @experimental Part of the experimental JSX component API - may change or be removed
 * in a minor release.
 */
export const jsxDEV = jsx

/**
 * The types TypeScript reads from the `jsxImportSource` module to type-check JSX
 * expressions: what an expression evaluates to, which tags exist with which
 * attributes, and which prop carries nested children.
 *
 * The namespace, its name and its member names are all part of the compiler's JSX
 * contract, hence the lint exemptions.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace JSX {
  type Element = RawHtml

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntrinsicElements extends IntrinsicElementAttributes {}

  interface ElementChildrenAttribute {
    children: unknown
  }
}
