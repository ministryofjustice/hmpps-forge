import { ArrayTransformers, arrayTransformersRegistry } from './arrayTransformers'
import { DateTransformers, dateTransformersRegistry } from './dateTransformers'
import { NumberTransformers, numberTransformersRegistry } from './numberTransformers'
import { ObjectTransformers, objectTransformersRegistry } from './objectTransformers'
import { StringTransformers, stringTransformersRegistry } from './stringTransformers'

export const Transformer = {
  /** Transformers for handling strings */
  String: StringTransformers,

  /** Transformers for handling numbers */
  Number: NumberTransformers,

  /** Transformers for handling arrays */
  Array: ArrayTransformers,

  /** Transformers for handling objects */
  Object: ObjectTransformers,

  /** Transformers for handling dates */
  Date: DateTransformers,
}

export const TransformersRegistry = {
  ...stringTransformersRegistry.build(),
  ...numberTransformersRegistry.build(),
  ...arrayTransformersRegistry.build(),
  ...objectTransformersRegistry.build(),
  ...dateTransformersRegistry.build(),
}
