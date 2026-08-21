import { ArrayTransformers } from './arrayTransformers'
import { DateTransformers } from './dateTransformers'
import { NumberTransformers } from './numberTransformers'
import { ObjectTransformers } from './objectTransformers'
import { StringTransformers } from './stringTransformers'
import { FunctionEntryRegistry } from '../../../authoring/functions/FunctionEntryRegistry'

// TypeScript declaration emit drops JSDoc when it structurally expands a type
// imported from another file, so the built .d.ts would lose every per-function
// doc comment. Annotating with `typeof` references makes the emitter print a
// reference instead of expanding, keeping the docs on each group's own declaration.
interface TransformerGroups {
  /** Transformers for handling strings */
  String: typeof StringTransformers

  /** Transformers for handling numbers */
  Number: typeof NumberTransformers

  /** Transformers for handling arrays */
  Array: typeof ArrayTransformers

  /** Transformers for handling objects */
  Object: typeof ObjectTransformers

  /** Transformers for handling dates */
  Date: typeof DateTransformers
}

export const Transformer: TransformerGroups = {
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

export const TransformersRegistry = (() => {
  const entryRegistry = new FunctionEntryRegistry()
  const transformerGroups = [
    StringTransformers,
    NumberTransformers,
    ArrayTransformers,
    ObjectTransformers,
    DateTransformers,
  ]

  transformerGroups.forEach(entries => Object.values(entries).forEach(entry => entryRegistry.collectListed(entry)))

  return entryRegistry.build()
})()
