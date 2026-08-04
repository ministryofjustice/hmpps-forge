/**
 * Normalize an application base path to either '' or '/segment[/child]'.
 */
export function normalizeBasePath(basePath?: string): string {
  if (!basePath) {
    return ''
  }

  let normalized = basePath

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }

  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }

  return normalized
}

/**
 * Normalize a relative journey path key for runtime comparisons.
 *
 * Keeps external URLs untouched apart from dropping query/hash fragments so
 * they never collide with internal step keys.
 */
export function normalizeRelativePath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path

  return normalizedPath.split(/[?#]/)[0] ?? normalizedPath
}

/**
 * Resolve route params embedded in a path template.
 */
export function resolvePathParams(path: string, params: Record<string, string>): string {
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, name) => params[name] ?? match)
}

/**
 * Join path segments, collapsing consecutive slashes.
 */
export function joinPaths(...segments: string[]): string {
  return `/${segments.join('/').split('/').filter(Boolean).join('/')}`
}
