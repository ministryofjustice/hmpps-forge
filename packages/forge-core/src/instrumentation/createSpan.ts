import type { ForgeSpan, ForgeSpanAttributes, ForgeSpanEvent } from './types'
import { ForgeSpanStatus } from './types'

interface CreateSpanFields {
  name: string
  status?: ForgeSpanStatus
  attributes?: ForgeSpanAttributes
  events?: ForgeSpanEvent[]
  error?: unknown
  startTime?: number
  endTime?: number
  spanId?: string
  parentSpanId?: string
}

export function createSpan(fields: CreateSpanFields): ForgeSpan {
  const startTime = fields.startTime ?? Date.now()

  return {
    name: fields.name,
    startTime,
    endTime: fields.endTime ?? startTime,
    status: fields.status ?? ForgeSpanStatus.OK,
    error: fields.error,
    attributes: fields.attributes ?? {},
    events: fields.events ?? [],
    spanId: fields.spanId,
    parentSpanId: fields.parentSpanId,
  }
}
