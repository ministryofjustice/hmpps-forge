/** Join an engine base path to a package journey path. */
export function joinRoutePaths(basePath: string, journeyPath: string): string {
  const segments = [basePath, journeyPath]
    .flatMap(segment => segment.split('/'))
    .filter(Boolean)

  return `/${segments.join('/')}`
}

/**
 * Resolve route params embedded in a path template.
 */
export function resolvePathParams(path: string, params: Record<string, string>): string {
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, name) => params[name] ?? match)
}
