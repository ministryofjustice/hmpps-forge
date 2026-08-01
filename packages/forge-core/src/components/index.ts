export { buildComponent } from './utils/buildComponent'
export type { BuildComponentOptions } from './utils/buildComponent'
export { component } from './component'
export { coreComponents, HtmlBlock, CollectionBlock, TemplateWrapper, Fragment } from './builtins'
export type { EvaluatedCollectionBlock } from './builtins'
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
  ResolvableBoolean,
  ResolvableNumber,
  ResolvableObject,
  ResolvableString,
  EvaluatedBlock,
  FieldBlockDefinition,
  FieldBlockProps,
  RenderedBlock,
} from './types/structures.type'
