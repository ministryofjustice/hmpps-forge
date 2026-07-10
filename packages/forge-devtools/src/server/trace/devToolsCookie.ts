import type { RequestTraceEvent } from '@ministryofjustice/hmpps-forge/core'

export const DEVTOOLS_COOKIE_NAME = '__forgeDevtools'

/**
 * Reads the devtools cookie from the snapshot. Checks `cookies` first
 * (present when the app uses cookie-parser), then falls back to parsing
 * the raw `Cookie` header so the devtools works without requiring the
 * host app to install cookie-parser.
 */
export function extractDevToolsCookie(snapshot: RequestTraceEvent['snapshot']): string | undefined {
  const fromParsed = snapshot.cookies?.[DEVTOOLS_COOKIE_NAME]

  if (fromParsed) {
    return fromParsed
  }

  const raw = snapshot.headers?.cookie

  if (typeof raw !== 'string') {
    return undefined
  }

  const prefix = `${DEVTOOLS_COOKIE_NAME}=`
  const pair = raw.split(';').find(segment => segment.trimStart().startsWith(prefix))

  return pair?.trimStart().slice(prefix.length)
}
