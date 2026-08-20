import type { CodeFragment } from './CodeFragment'

export interface ObjectExpressionProperty {
  readonly key: CodeFragment
  readonly value: CodeFragment
}

/** Holds a generated object literal as separate key-value pairs, so `SourceRenderer` can format it across multiple lines if needed. */
export default class ObjectExpressionToken {
  private readonly objectProperties: readonly ObjectExpressionProperty[]

  constructor(properties: readonly ObjectExpressionProperty[]) {
    this.objectProperties = Object.freeze(properties.map(property => Object.freeze({ ...property })))
    Object.freeze(this)
  }

  get properties(): readonly ObjectExpressionProperty[] {
    return this.objectProperties
  }
}
