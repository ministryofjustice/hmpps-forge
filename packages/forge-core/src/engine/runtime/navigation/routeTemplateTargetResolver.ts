export function resolveRouteTemplateTargetPath(target: string, currentRouteTemplatePath: string): string | undefined {
  if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('//')) {
    return undefined
  }

  const pathOnly = stripSearchAndHash(target)

  if (pathOnly.startsWith('/')) {
    return normalizePath(pathOnly, [])
  }

  return normalizePath(pathOnly, getBaseSegments(currentRouteTemplatePath))
}

function stripSearchAndHash(value: string): string {
  const queryIndex = value.indexOf('?')
  const hashIndex = value.indexOf('#')
  const indexes = [queryIndex, hashIndex].filter(index => index >= 0)

  if (indexes.length === 0) {
    return value
  }

  return value.slice(0, Math.min(...indexes))
}

function getBaseSegments(currentRouteTemplatePath: string): string[] {
  const currentSegments = splitPath(currentRouteTemplatePath)

  if (currentRouteTemplatePath.endsWith('/')) {
    return currentSegments
  }

  return currentSegments.slice(0, -1)
}

function normalizePath(path: string, baseSegments: string[]): string {
  const segments = [...baseSegments]

  splitPath(path).forEach(segment => {
    if (segment === '.') {
      return
    }

    if (segment === '..') {
      segments.pop()

      return
    }

    segments.push(segment)
  })

  return `/${segments.join('/')}`
}

function splitPath(path: string): string[] {
  return path.split('/').filter(segment => segment.length > 0)
}
