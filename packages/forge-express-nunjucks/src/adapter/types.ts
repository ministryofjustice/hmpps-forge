import type express from 'express'

/**
 * Extended Express Request with optional state property
 */
export interface RequestWithState extends express.Request {
  state: Record<string, unknown>
}
