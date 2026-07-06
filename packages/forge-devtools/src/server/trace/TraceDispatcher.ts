import type { RequestTraceEvent } from '@ministryofjustice/hmpps-forge/core'
import type DevToolsSession from '../session/DevToolsSession'
import TraceMessageBuilder from './TraceMessageBuilder'
import { extractDevToolsCookie } from './devToolsCookie'

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
    const cookie = extractDevToolsCookie(event.snapshot)
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
}
