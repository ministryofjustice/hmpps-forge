import type { Code } from './Code'

/** Keeps a generated array structured until source rendering. */
export default class ArrayExpressionToken {
  private readonly arrayValues: readonly Code[]

  constructor(values: readonly Code[]) {
    this.arrayValues = Object.freeze([...values])
    Object.freeze(this)
  }

  get values(): readonly Code[] {
    return this.arrayValues
  }
}
