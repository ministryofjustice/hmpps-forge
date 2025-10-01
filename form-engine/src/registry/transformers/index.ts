import { ArrayTransformers, ArrayTransformersRegistry } from './arrayTransformers'
import { NumberTransformers, NumberTransformersRegistry } from './numberTransformers'
import { ObjectTransformers, ObjectTransformersRegistry } from './objectTransformers'
import { StringTransformers, StringTransformersRegistry } from './stringTransformers'

export const Transformer = {
  /** Transformers for handling strings */
  String: StringTransformers,

  /** Transformers for handling numbers */
  Number: NumberTransformers,

  /** Transformers for handling arrays */
  Array: ArrayTransformers,

  /** Transformers for handling objects */
  Object: ObjectTransformers,
}

export const TransformersRegistry = {
  ...StringTransformersRegistry,
  ...NumberTransformersRegistry,
  ...ArrayTransformersRegistry,
  ...ObjectTransformersRegistry,
}
