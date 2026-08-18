import type { CodeFragment } from './CodeFragment'

/** Holds a generated array literal as separate `CodeFragment` elements, so `SourceRenderer` can format it across multiple lines if needed. */
export default class ArrayExpressionToken {
  private readonly arrayValues: readonly CodeFragment[]

  constructor(values: readonly CodeFragment[]) {
    this.arrayValues = Object.freeze([...values])
    Object.freeze(this)
  }

  get values(): readonly CodeFragment[] {
    return this.arrayValues
  }
}
