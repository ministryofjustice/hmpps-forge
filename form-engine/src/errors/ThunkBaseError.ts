import { formatBox } from '@form-engine/logging/formatBox'
import { NodeId } from '@form-engine/core/types/engine.type'
import { ThunkError, ThunkErrorType } from '@form-engine/core/compilation/thunks/types'

export default class ThunkBaseError extends Error {
  readonly type: ThunkErrorType

  readonly nodeId: NodeId

  readonly context: Record<string, unknown>

  constructor(type: ThunkErrorType, nodeId: NodeId, message: string, context: Record<string, unknown> = {}) {
    super(message)
    this.name = new.target.name
    this.type = type
    this.nodeId = nodeId
    this.context = context

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target)
    }
  }

  toThunkError(): ThunkError {
    return {
      type: this.type,
      nodeId: this.nodeId,
      message: this.message,
      cause: this,
      context: this.context,
    }
  }

  toString(): string {
    const fields = [
      { label: 'NodeId', value: this.nodeId },
      { label: 'Message', value: this.message },...Object.entries(this.context)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => ({ label: k, value: String(v) })),
    ]

    return formatBox(fields, { title: this.name })
  }
}
