import type { Code } from './Code'

export interface ObjectExpressionProperty {
  readonly key: Code
  readonly value: Code
}

/** Keeps a generated object structured until source rendering. */
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
