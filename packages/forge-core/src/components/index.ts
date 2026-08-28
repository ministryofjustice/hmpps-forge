export { buildComponent } from './utils/buildComponent'
export type { BuildComponentOptions } from './utils/buildComponent'
export { component, isForgeComponent } from './component'
export { coreComponents, HtmlBlock, CollectionBlock, TemplateWrapper, Fragment } from '../built-ins/components'
export type { EvaluatedCollectionBlock } from '../built-ins/components'
export type {
  ComponentRegistryEntry,
  ComponentRenderer,
  PropsOf,
  ResolvedPropsOf,
  ForgeComponent,
  ComponentOptions,
} from './types/components.type'
export type {
  BasicBlockProps,
  BlockDefinition,
  ResolvableArray,
  ResolvableBlockProps,
  ResolvableBoolean,
  ResolvableFieldProps,
  ResolvableNumber,
  ResolvableObject,
  ResolvableProps,
  ResolvableString,
  EvaluatedBlock,
  FieldBlockDefinition,
  FieldBlockProps,
  RenderedBlock,
} from './types/structures.type'
