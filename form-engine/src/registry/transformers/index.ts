import ArrayTransformers from './arrayTransformers'
import NumberTransformers from './numberTransformers'
import ObjectTransformers from './objectTransformers'
import StringTransformers from './stringTransformers'

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
