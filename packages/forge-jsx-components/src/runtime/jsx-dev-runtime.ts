/**
 * Development-mode entry for the forge JSX runtime - dev transforms (Vite, esbuild
 * with jsxDev, TypeScript's "react-jsxdev") import `<jsxImportSource>/jsx-dev-runtime`
 * and call `jsxDEV` instead of `jsx`/`jsxs`.
 *
 * The extra dev arguments (key, static-children flag, source location) only matter to
 * frameworks that diff and re-render, so this delegates straight to the production
 * implementation.
 *
 * @experimental Part of the experimental JSX component API - may change or be removed
 * in a minor release.
 */
import { jsx } from './jsx-runtime'

export { Fragment } from './jsx-runtime'
export type { JSX } from './jsx-runtime'

export const jsxDEV: typeof jsx = (tag, props) => jsx(tag, props)
