import { component } from '@ministryofjustice/hmpps-forge/core/components'

export interface LlmContentItem {
  /** Markdown content the LLM should communicate when this item is visible. */
  readonly content: string

  /** Whether this item should be included in the resolved content. */
  readonly visibleWhen?: boolean
}

export interface LlmContent {
  /** Markdown content, optionally composed from conditionally visible items. */
  readonly content: string | readonly LlmContentItem[]
}

export interface LlmContentOutput {
  readonly kind: 'content'
  readonly content: string
}

/** Provides informational Markdown content that does not collect an answer. */
export const LlmContent = component<LlmContent>('llmContent', {
  factory: () => props => ({
    kind: 'content',
    content:
      typeof props.content === 'string'
        ? props.content
        : props.content
            .filter(item => item.visibleWhen !== false)
            .map(item => item.content)
            .join('\n\n'),
  }),
})
