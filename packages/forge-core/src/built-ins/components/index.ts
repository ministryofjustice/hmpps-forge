import { HtmlBlock } from './html'
import { CollectionBlock } from './collectionBlock'
import { TemplateWrapper } from './templateWrapper'
import { Fragment } from './fragment'

export const builtInComponents = [HtmlBlock, CollectionBlock, TemplateWrapper, Fragment] as const

// Re-export the components (each const is both the block builder and the registry entry)
export { HtmlBlock } from './html'
export { CollectionBlock } from './collectionBlock'
export { TemplateWrapper } from './templateWrapper'
export { Fragment } from './fragment'
