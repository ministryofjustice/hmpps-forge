import { html } from './html'
import { collectionBlock } from './collectionBlock'
import { templateWrapper } from './templateWrapper'

export const coreComponents = [html, collectionBlock, templateWrapper]

// Re-export types only (for types that don't have wrapper functions)
export type { EvaluatedCollectionBlock } from './collectionBlock'

// Re-export wrapper functions (types are exported implicitly with the functions)
export { HtmlBlock } from './html'
export { CollectionBlock } from './collectionBlock'
export { TemplateWrapper } from './templateWrapper'
