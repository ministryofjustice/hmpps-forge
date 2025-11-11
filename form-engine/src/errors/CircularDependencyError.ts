import { formatBox } from '@form-engine/logging/formatBox'
import { NodeId } from '@form-engine/core/types/engine.type'

interface CircularDependencyErrorOptions {
  /** Human-readable error message */
  message: string
  /** The detected cycles (array of node ID chains forming cycles) */
  cycles: NodeId[][]
  /** Error code for programmatic handling */
  code?: string
}

export default class CircularDependencyError extends Error {
  readonly cycles: NodeId[][]

  readonly code?: string

  constructor(options: CircularDependencyErrorOptions) {
    let { message } = options

    // Add cycle count to message
    if (options.cycles && options.cycles.length > 0) {
      message += ` (${options.cycles.length} cycle${options.cycles.length === 1 ? '' : 's'} detected)`
    }

    super(message)
    this.name = new.target.name
    this.message = message
    this.cycles = options.cycles
    this.code = options.code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target)
    }
  }

  toString() {
    const fields = [
      { label: 'Code', value: this.code },
      { label: 'Message', value: this.message },
      { label: 'Cycle Count', value: this.cycles.length },
    ]

    this.cycles.forEach((cycle, index) => {
      fields.push({
        label: `Cycle ${index + 1}`,
        value: cycle.join(' → '),
      })
    })

    return formatBox(fields, { title: this.name })
  }
}
