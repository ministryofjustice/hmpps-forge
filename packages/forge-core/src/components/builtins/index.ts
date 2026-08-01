import { HtmlBlock } from './html'
import { CollectionBlock } from './collectionBlock'
import { TemplateWrapper } from './templateWrapper'
import { Fragment } from './fragment'

export const coreComponents = [HtmlBlock, CollectionBlock, TemplateWrapper, Fragment]

// Re-export supporting types
export type { EvaluatedCollectionBlock } from './collectionBlock'

// Re-export the components (each const is both the block builder and the registry entry)
export { HtmlBlock } from './html'
export { CollectionBlock } from './collectionBlock'
export { TemplateWrapper } from './templateWrapper'
export { Fragment } from './fragment'
