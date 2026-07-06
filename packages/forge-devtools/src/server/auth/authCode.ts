import { randomBytes } from 'node:crypto'

const CODE_LENGTH = 5
const CODE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CODE_EXPIRY_MS = 300_000
const MAX_ATTEMPTS = 3

export interface PendingCode {
  readonly code: string
  readonly expiresAt: number
  attempts: number
}

export type CodeValidationResult = 'valid' | 'invalid' | 'expired' | 'max-attempts'

export function generateCode(): PendingCode {
  const bytes = randomBytes(CODE_LENGTH)
  const code = Array.from(bytes, byte => CODE_CHARSET[byte % CODE_CHARSET.length]).join('')

  return {
    code,
    expiresAt: Date.now() + CODE_EXPIRY_MS,
    attempts: 0,
  }
}

export function validateCode(pending: PendingCode, submitted: string): CodeValidationResult {
  if (Date.now() > pending.expiresAt) {
    return 'expired'
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    return 'max-attempts'
  }

  pending.attempts += 1

  if (submitted.toUpperCase() === pending.code) {
    return 'valid'
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    return 'max-attempts'
  }

  return 'invalid'
}
