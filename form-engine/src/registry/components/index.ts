import { html } from '@form-engine/registry/components/html'
import { collectionBlock } from '@form-engine/registry/components/collectionBlock'
import { templateWrapper } from '@form-engine/registry/components/templateWrapper'

export const coreComponents = [html, collectionBlock, templateWrapper]

// Re-export types only (for types that don't have wrapper functions)
export type { EvaluatedCollectionBlock } from '@form-engine/registry/components/collectionBlock'

// Re-export wrapper functions (types are exported implicitly with the functions)
export { HtmlBlock } from '@form-engine/registry/components/html'
export { CollectionBlock } from '@form-engine/registry/components/collectionBlock'
export { TemplateWrapper } from '@form-engine/registry/components/templateWrapper'
