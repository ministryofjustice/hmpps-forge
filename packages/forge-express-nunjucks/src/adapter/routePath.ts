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
