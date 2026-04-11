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
 * Extract a pathname from either an absolute URL or a relative request URL.
 */
export function extractPathname(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    const [withoutHash] = url.split('#', 1)
    const [path] = withoutHash.split('?', 1)

    return path
  }
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

/**
 * Resolve a redirect or backlink target against the current mounted base path.
 */
export function resolveMountedPath(basePath: string, target: string): string {
  if (target.includes('://') || target.startsWith('/')) {
    return target
  }

  return joinPaths(basePath, target)
}
