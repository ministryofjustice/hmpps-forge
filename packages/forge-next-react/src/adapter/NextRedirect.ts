/**
 * Normalizes a Forge navigate URL for a Next flow that redirects in-app (page
 * and action flows). Absolute URLs and root-relative paths pass through
 * unchanged; anything else is resolved against the request and stripped to
 * `pathname + search + hash`.
 */
export default class NextRedirect {
  static toTarget(url: string, request: Request): string {
    if (url.includes('://') || url.startsWith('/')) {
      return url
    }

    const resolved = new URL(url, request.url)

    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  }
}
