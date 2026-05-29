import { hrTimeDuration, millisToHrTime } from './utils'
import type { ForgeSpan, ForgeSpanAttributes, ForgeSpanEvent, HrTime } from './types'
import { ForgeSpanStatus } from './types'

interface CreateSpanFields {
  name: string
  status?: ForgeSpanStatus
  attributes?: ForgeSpanAttributes
  events?: ForgeSpanEvent[]
  error?: unknown
  startTime?: HrTime
  endTime?: HrTime
  duration?: HrTime
  spanId?: string
  parentSpanId?: string
}

export function createSpan(fields: CreateSpanFields): ForgeSpan {
  const startTime = fields.startTime ?? millisToHrTime(Date.now())
  const endTime = fields.endTime ?? startTime
  const duration = fields.duration ?? hrTimeDuration(startTime, endTime)

  return {
    name: fields.name,
    startTime,
    endTime,
    duration,
    status: fields.status ?? ForgeSpanStatus.OK,
    error: fields.error,
    attributes: fields.attributes ?? {},
    events: fields.events ?? [],
    spanId: fields.spanId,
    parentSpanId: fields.parentSpanId,
  }
}
