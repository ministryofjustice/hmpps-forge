/**
 * Join path segments, collapsing consecutive slashes.
 * e.g. joinPaths('/', '/') → '/', joinPaths('/feedback', '/name') → '/feedback/name'
 */
export default function joinPaths(...segments: string[]): string {
  return `/${segments.join('/').split('/').filter(Boolean).join('/')}`
}
