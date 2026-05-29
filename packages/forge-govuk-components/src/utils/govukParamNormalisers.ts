import type { RenderedBlock } from '@ministryofjustice/hmpps-forge/core/components'

type GovukTextParam<T extends object> = T | { text: string }

interface GovukError {
  readonly message: string
}

export type GovukRenderedBlockContent = RenderedBlock | readonly RenderedBlock[] | undefined

export interface GovukTextHtmlContent {
  readonly text?: string
  readonly html?: string
  readonly blocks?: GovukRenderedBlockContent
}

export interface GovukNormalisedTextHtmlContent {
  text?: string
  html?: string
}

/**
 * Converts Forge's convenient string-or-object API into the object shape
 * expected by GOV.UK Frontend Nunjucks params.
 */
export function normaliseGovukTextParam<T extends object>(
  value: string | T | undefined,
): GovukTextParam<T> | undefined {
  if (typeof value === 'object') {
    return value
  }

  if (value === undefined || value === '') {
    return undefined
  }

  return { text: value }
}

/**
 * GOV.UK grouped controls use fieldsets, but Forge also accepts a simple label
 * for the common case where only the legend text needs to be supplied.
 */
export function normaliseGovukFieldset<T extends object>(
  fieldset: T | undefined,
  legendText: string | undefined,
): T | { legend: { text: string } } | undefined {
  if (fieldset) {
    return fieldset
  }

  if (legendText === undefined || legendText === '') {
    return undefined
  }

  return {
    legend: {
      text: legendText,
    },
  }
}

export function normaliseGovukErrorMessage(errors: readonly GovukError[] | undefined): { text: string } | undefined {
  const firstError = errors?.[0]

  if (!firstError || firstError.message === '') {
    return undefined
  }

  return { text: firstError.message }
}

export function renderGovukBlocksToHtml(blocks: GovukRenderedBlockContent): string | undefined {
  if (!blocks) {
    return undefined
  }

  const renderedBlocks = Array.isArray(blocks) ? blocks : [blocks]

  if (renderedBlocks.length === 0) {
    return undefined
  }

  return renderedBlocks.map(block => block.html).join('')
}

export function normaliseGovukTextHtmlContent(content: GovukTextHtmlContent): GovukNormalisedTextHtmlContent {
  const blocksHtml = renderGovukBlocksToHtml(content.blocks)
  const html = blocksHtml ?? content.html

  return {
    text: html !== undefined ? undefined : content.text,
    html,
  }
}
