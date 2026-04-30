import type { RenderedBlock } from '@ministryofjustice/hmpps-forge/core/components'

type MojRenderedBlockContent = RenderedBlock | readonly RenderedBlock[] | undefined

interface MojTextHtmlContent {
  readonly text?: string
  readonly html?: string
  readonly blocks?: MojRenderedBlockContent
}

interface MojNormalisedTextHtmlContent {
  text?: string
  html?: string
}

function renderMojBlocksToHtml(blocks: MojRenderedBlockContent): string | undefined {
  if (!blocks) {
    return undefined
  }

  const renderedBlocks = Array.isArray(blocks) ? blocks : [blocks]

  if (renderedBlocks.length === 0) {
    return undefined
  }

  return renderedBlocks.map(block => block.html).join('')
}

export function normaliseMojTextHtmlContent(content: MojTextHtmlContent): MojNormalisedTextHtmlContent {
  const blocksHtml = renderMojBlocksToHtml(content.blocks)

  return {
    text: blocksHtml !== undefined ? undefined : content.text,
    html: blocksHtml ?? content.html,
  }
}
