import type MarkdownIt from 'markdown-it'
import type { Token, Options, Renderer } from 'markdown-it'
import createMarkdownIt from 'markdown-it'
import markdownItAttrs from 'markdown-it-attrs'
import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import yaml from 'highlight.js/lib/languages/yaml'
import django from 'highlight.js/lib/languages/django'
import { buildComponent } from '@ministryofjustice/hmpps-forge/core/components'
import { block as blockBuilder } from '@ministryofjustice/hmpps-forge/core/authoring'
import type {
  BasicBlockProps,
  BlockDefinition,
  ResolvableString,
  RenderedBlock,
} from '@ministryofjustice/hmpps-forge/core/components'

hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('nunjucks', django)
hljs.registerLanguage('njk', django)
hljs.registerLanguage('jinja', django)
hljs.registerLanguage('jinja2', django)

/**
 * GOV.UK Markdown Component
 *
 * Renders markdown content with GOV.UK Design System styling.
 *
 * Mapping:
 * - # H1        -> <h1 class="govuk-heading-xl">
 * - ## H2       -> <h2 class="govuk-heading-l">
 * - ### H3      -> <h3 class="govuk-heading-m">
 * - #### H4     -> <h4 class="govuk-heading-s">
 * - paragraph   -> <p class="govuk-body">
 * - - list      -> <ul class="govuk-list govuk-list--bullet">
 * - 1. list     -> <ol class="govuk-list govuk-list--number">
 * - [link](url) -> <a class="govuk-link" href="url">
 * - ---         -> <hr class="govuk-section-break govuk-section-break--l govuk-section-break--visible">
 * - > quote     -> <div class="govuk-inset-text">
 * - `code`      -> <code>
 * - | table |   -> <table class="govuk-table">
 */

type RenderRule = (
  tokens: Token[],
  idx: number,
  options: Options,
  env: unknown,
  self: Renderer,
) => string

const md: MarkdownIt = createMarkdownIt({
  html: true,
  breaks: false,
  linkify: true,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return `<pre><code class="hljs language-${lang}">${hljs.highlight(str, { language: lang }).value}</code></pre>`
    }

    return ''
  },
})

md.use(markdownItAttrs, {
  leftDelimiter: '{',
  rightDelimiter: '}',
  allowedAttributes: ['class', 'id', 'style'],
})

const defaultRender: Record<string, RenderRule | undefined> = {
  heading_open: md.renderer.rules.heading_open,
  paragraph_open: md.renderer.rules.paragraph_open,
  bullet_list_open: md.renderer.rules.bullet_list_open,
  ordered_list_open: md.renderer.rules.ordered_list_open,
  link_open: md.renderer.rules.link_open,
}

const headingSizes: Record<string, string> = {
  h1: 'xl',
  h2: 'l',
  h3: 'm',
  h4: 's',
  h5: 's',
  h6: 's',
}

function mergeClasses(govukClass: string, existingClass?: string): string {
  if (!existingClass) {
    return govukClass
  }

  if (existingClass.includes('lead')) {
    return existingClass.replace('lead', 'govuk-body-l')
  }

  return `${govukClass} ${existingClass}`
}

function renderWithDefault(
  ruleName: string,
  tokens: Token[],
  idx: number,
  options: Options,
  env: unknown,
  self: Renderer,
): string {
  const defaultRenderer = defaultRender[ruleName]

  return defaultRenderer
    ? defaultRenderer(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options)
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const size = headingSizes[token.tag] ?? 's'
  token.attrSet('class', mergeClasses(`govuk-heading-${size}`, token.attrGet('class') ?? undefined))

  if (!token.attrGet('id')) {
    const inlineToken = tokens[idx + 1]
    const headingText = inlineToken?.children?.map(t => t.content).join('') ?? ''

    if (headingText) {
      token.attrSet('id', slugify(headingText))
    }
  }

  return renderWithDefault('heading_open', tokens, idx, options, env, self)
}

md.renderer.rules.paragraph_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const existingClass = token.attrGet('class')

  if (existingClass?.includes('lead')) {
    token.attrSet('class', existingClass.replace('lead', 'govuk-body-l'))
  } else {
    token.attrSet('class', mergeClasses('govuk-body', existingClass ?? undefined))
  }

  return renderWithDefault('paragraph_open', tokens, idx, options, env, self)
}

md.renderer.rules.bullet_list_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  token.attrSet(
    'class',
    mergeClasses('govuk-list govuk-list--bullet', token.attrGet('class') ?? undefined),
  )

  return renderWithDefault('bullet_list_open', tokens, idx, options, env, self)
}

md.renderer.rules.ordered_list_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  token.attrSet(
    'class',
    mergeClasses('govuk-list govuk-list--number', token.attrGet('class') ?? undefined),
  )

  return renderWithDefault('ordered_list_open', tokens, idx, options, env, self)
}

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  token.attrSet('class', mergeClasses('govuk-link', token.attrGet('class') ?? undefined))

  return renderWithDefault('link_open', tokens, idx, options, env, self)
}

md.renderer.rules.hr = () =>
  '<hr class="govuk-section-break govuk-section-break--l govuk-section-break--visible">\n'

md.renderer.rules.blockquote_open = () => '<div class="govuk-inset-text">\n'
md.renderer.rules.blockquote_close = () => '</div>\n'

md.renderer.rules.table_open = () => '<table class="govuk-table">\n'
md.renderer.rules.thead_open = () => '<thead class="govuk-table__head">\n'
md.renderer.rules.tbody_open = () => '<tbody class="govuk-table__body">\n'
md.renderer.rules.tr_open = () => '<tr class="govuk-table__row">\n'

md.renderer.rules.th_open = (tokens, idx) => {
  const align = tokens[idx].attrGet('style')

  return align
    ? `<th scope="col" class="govuk-table__header" style="${align}">`
    : '<th scope="col" class="govuk-table__header">'
}

md.renderer.rules.td_open = (tokens, idx) => {
  const align = tokens[idx].attrGet('style')

  return align
    ? `<td class="govuk-table__cell" style="${align}">`
    : '<td class="govuk-table__cell">'
}

function renderGovUKMarkdown(markdown: string): string {
  return md.render(markdown.trim())
}

// Component definition

export interface GovUKMarkdownBlockProps extends BasicBlockProps {
  content: ResolvableString
  slots?: Record<string, BlockDefinition[]>
}

export interface GovUKMarkdownBlock extends BlockDefinition, GovUKMarkdownBlockProps {
  variant: 'govukMarkdown'
}

const slotMarkerPattern = /\{\{slot:([^}]+)\}\}/g
const slotPlaceholderPattern = /<div data-forge-slot="([^"]+)"><\/div>/g

function replaceSlotMarkers(markdown: string): string {
  return markdown.replace(slotMarkerPattern, '<div data-forge-slot="$1"></div>')
}

function replaceSlotPlaceholders(html: string, slots: Record<string, RenderedBlock[]>): string {
  return html.replace(slotPlaceholderPattern, (_, slotName) => {
    const renderedBlocks = slots[slotName]

    if (!renderedBlocks) {
      return ''
    }

    return renderedBlocks.map(block => block.html).join('')
  })
}

export const govukMarkdown = buildComponent<GovUKMarkdownBlock>('govukMarkdown', block => {
  if (!block.content) {
    return ''
  }

  const markdown = block.slots ? replaceSlotMarkers(block.content) : block.content
  let html = renderGovUKMarkdown(markdown)

  if (block.slots) {
    html = replaceSlotPlaceholders(html, block.slots)
  }

  return html
})

export function GovUKMarkdownBlock(props: GovUKMarkdownBlockProps): GovUKMarkdownBlock {
  return blockBuilder<GovUKMarkdownBlock>({ ...props, variant: 'govukMarkdown' })
}
