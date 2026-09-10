/** A normalized browser URL shared by routing, history, and request snapshots. */
export default class BrowserNavigationUrl {
  private constructor(private readonly url: URL) {}

  static resolve(value: string, baseUrl: string): BrowserNavigationUrl {
    return new BrowserNavigationUrl(new URL(value, baseUrl))
  }

  static fromLocation(href: string): BrowserNavigationUrl {
    return new BrowserNavigationUrl(new URL(href))
  }

  getOrigin(): string {
    return this.url.origin
  }

  getPathname(): string {
    return this.url.pathname
  }

  getFragment(): string | undefined {
    return this.url.hash.length > 1 ? this.url.hash.slice(1) : undefined
  }

  getQuery(): Record<string, string | string[]> {
    const query = new Map<string, string | string[]>()

    this.url.searchParams.forEach((value, name) => {
      const existing = query.get(name)

      if (existing === undefined) {
        query.set(name, value)
      } else if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        query.set(name, [existing, value])
      }
    })

    return Object.fromEntries(query)
  }

  isSameOrigin(origin: string): boolean {
    return this.url.origin === origin
  }

  toAbsoluteUrl(): string {
    return this.url.href
  }

  toRelativeUrl(): string {
    return `${this.toRequestPath()}${this.url.hash}`
  }

  toRequestPath(): string {
    return `${this.url.pathname}${this.url.search}`
  }

  toRequestHref(): string {
    return `${this.url.origin}${this.toRequestPath()}`
  }
}
