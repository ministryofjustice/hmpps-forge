import { RequestLocation } from '../../../framework/types/request.type'

export type ParsedRedirectTarget =
  | { kind: 'external'; value: string }
  | { kind: 'absolute'; value: string }
  | { kind: 'relative'; value: string }

export interface ResolvedRedirectTarget {
  kind: ParsedRedirectTarget['kind']
  value: string
  pathname: string
}

export function parseRedirectTarget(target: string): ParsedRedirectTarget {
  if (target.startsWith('http://') || target.startsWith('https://')) {
    return { kind: 'external', value: target }
  }

  if (target.startsWith('/')) {
    return { kind: 'absolute', value: target }
  }

  return { kind: 'relative', value: target }
}

export function resolveRedirectTarget(
  target: string | ParsedRedirectTarget,
  location: Pick<RequestLocation, 'origin' | 'pathname'> & { basePath?: string },
): ResolvedRedirectTarget {
  const parsedTarget = typeof target === 'string' ? parseRedirectTarget(target) : target

  if (parsedTarget.kind === 'external') {
    const resolvedUrl = new URL(parsedTarget.value)

    return {
      kind: parsedTarget.kind,
      value: resolvedUrl.href,
      pathname: resolvedUrl.pathname,
    }
  }

  if (parsedTarget.kind === 'absolute') {
    const resolvedUrl = new URL(encodePathTemplate(parsedTarget.value), location.origin)
    const pathname = decodePathTemplate(resolvedUrl.pathname)
    const value = decodePathTemplate(`${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`)

    return {
      kind: parsedTarget.kind,
      value,
      pathname,
    }
  }

  const isDotRelative = parsedTarget.value.startsWith('./') || parsedTarget.value.startsWith('../')

  const base = !isDotRelative && location.basePath !== undefined
    ? `${location.origin}${encodePathTemplate(location.basePath)}/`
    : `${location.origin}${encodePathTemplate(location.pathname)}`

  const resolvedUrl = new URL(encodePathTemplate(parsedTarget.value), base)
  const pathname = decodePathTemplate(resolvedUrl.pathname)
  const value = decodePathTemplate(`${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`)

  return {
    kind: parsedTarget.kind,
    value,
    pathname,
  }
}

function encodePathTemplate(path: string): string {
  return path.replace(/:/g, '%3A')
}

function decodePathTemplate(path: string): string {
  return path.replace(/%3A/gi, ':')
}
