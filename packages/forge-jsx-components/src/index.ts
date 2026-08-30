/**
 * forge-jsx-components
 *
 * JSX authoring for forge components, with no framework underneath - JSX compiles
 * straight to escaped HTML strings via this package's own runtime, so components
 * written with it render exactly like any other string-producing component.
 *
 * To author in JSX, point TypeScript's automatic transform at this package:
 *
 * ```jsonc
 * // tsconfig.json
 * "jsx": "react-jsx",
 * "jsxImportSource": "@ministryofjustice/hmpps-forge/jsx-components"
 * ```
 *
 * @experimental Everything in this package is experimental - it may change or be
 * removed in a minor release.
 *
 * @example
 * ```tsx
 * import { jsxComponent } from '@ministryofjustice/hmpps-forge/jsx-components'
 *
 * export const MyBadge = jsxComponent<MyBadge>('myBadge', {
 *   factory: () => ({ props }) => <strong class="moj-badge">{props.text}</strong>,
 * })
 * ```
 */

export { jsxComponent } from './utils/jsxComponent'
export { RawHtml, raw } from './runtime/jsx-runtime'
export type { JsxChild, JsxProps } from './runtime/jsx-runtime'
