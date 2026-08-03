/**
 * Extract a pathname from either an absolute URL or a relative request URL.
 *
 * The test client plays the framework adapter's role - turning a raw URL into
 * snapshot terms - so it carries its own copy of this adapter-side helper.
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
