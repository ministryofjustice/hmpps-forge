import { randomBytes } from 'node:crypto'
import type { WebSocket } from 'ws'
import { generateCode, validateCode, type CodeValidationResult, type PendingCode } from '../auth/authCode'

export type SessionState = 'awaiting-code' | 'authenticated' | 'rejected'

export default class DevToolsSession {
  private readonly clientId = randomBytes(2).toString('hex')

  private state: SessionState = 'awaiting-code'

  private pendingCode: PendingCode

  private cookieValue?: string

  constructor(private readonly ws: WebSocket) {
    this.pendingCode = generateCode()
  }

  getId(): string {
    return this.clientId
  }

  getState(): SessionState {
    return this.state
  }

  getCode(): string {
    return this.pendingCode.code
  }

  getCodeExpiresIn(): number {
    return Math.max(0, this.pendingCode.expiresAt - Date.now())
  }

  getCookieValue(): string | undefined {
    return this.cookieValue
  }

  getRemainingAttempts(): number {
    return 3 - this.pendingCode.attempts
  }

  authenticateImmediately(): void {
    this.state = 'authenticated'
    this.cookieValue = randomBytes(32).toString('hex')
    this.send({ type: 'auth:success', cookie: this.cookieValue })
  }

  refreshCode(): void {
    this.state = 'awaiting-code'
    this.pendingCode = generateCode()
    this.sendChallenge()
  }

  handleAuthCode(code: string): CodeValidationResult {
    if (this.state !== 'awaiting-code') {
      return 'max-attempts'
    }

    const result = validateCode(this.pendingCode, code)

    if (result === 'valid') {
      this.state = 'authenticated'
      this.cookieValue = randomBytes(32).toString('hex')
      this.send({ type: 'auth:success', cookie: this.cookieValue })

      return result
    }

    if (result === 'expired') {
      this.send({ type: 'auth:expired' })

      return result
    }

    if (result === 'max-attempts') {
      this.send({ type: 'auth:rejected' })

      return result
    }

    this.send({ type: 'auth:failed', attemptsRemaining: this.getRemainingAttempts() })

    return result
  }

  sendChallenge(): void {
    this.send({ type: 'auth:challenge', expiresIn: this.getCodeExpiresIn() })
  }

  send(message: Record<string, unknown>): void {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  close(): void {
    this.ws.close()
  }
}
