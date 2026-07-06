import type { RequestTraceEvent } from '@ministryofjustice/hmpps-forge/core'
import type DevToolsSession from '../session/DevToolsSession'
import TraceMessageBuilder from './TraceMessageBuilder'

const DEVTOOLS_COOKIE_NAME = '__forgeDevtools'

export default class TraceDispatcher {
  private readonly builder = new TraceMessageBuilder()

  private readonly sessions = new Set<DevToolsSession>()

  addSession(session: DevToolsSession): void {
    this.sessions.add(session)
  }

  removeSession(session: DevToolsSession): void {
    this.sessions.delete(session)
  }

  closeAll(): void {
    this.sessions.forEach(session => session.close())
    this.sessions.clear()
  }

  onRequestTrace(event: RequestTraceEvent): void {
    const cookie = this.extractDevToolsCookie(event.snapshot)
    const message = this.builder.build(event)

    this.sessions.forEach(session => {
      if (session.getState() !== 'authenticated') {
        return
      }

      if (cookie !== session.getCookieValue()) {
        return
      }

      session.send(message)
    })
  }

  /**
   * Reads the devtools cookie from the snapshot. Checks `cookies` first
   * (present when the app uses cookie-parser), then falls back to parsing
   * the raw `Cookie` header so the devtools works without requiring the
   * host app to install cookie-parser.
   */
  private extractDevToolsCookie(snapshot: RequestTraceEvent['snapshot']): string | undefined {
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
}
