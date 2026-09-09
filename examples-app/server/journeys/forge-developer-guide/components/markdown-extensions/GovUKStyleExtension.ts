import type MarkdownIt from 'markdown-it'
import type { Token, Options, Renderer } from 'markdown-it'
import { MarkdownExtension } from './MarkdownExtension'

type RenderRule = (
  tokens: Token[],
  idx: number,
  options: Options,
  env: unknown,
  self: Renderer,
) => string

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
  defaultRender: Record<string, RenderRule | undefined>,
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

export class GovUKStyleExtension extends MarkdownExtension {
  registerPlugin(markdownIt: MarkdownIt): void {
    const rendererRules = markdownIt.renderer.rules
    const defaultRender: Record<string, RenderRule | undefined> = {
      heading_open: rendererRules.heading_open,
      paragraph_open: rendererRules.paragraph_open,
      bullet_list_open: rendererRules.bullet_list_open,
      ordered_list_open: rendererRules.ordered_list_open,
      link_open: rendererRules.link_open,
    }

    rendererRules.heading_open = (tokens, idx, options, env, self) => {
      const token = tokens[idx]
      const size = headingSizes[token.tag] ?? 's'

      token.attrSet(
        'class',
        mergeClasses(`govuk-heading-${size}`, token.attrGet('class') ?? undefined),
      )

      if (!token.attrGet('id')) {
        const inlineToken = tokens[idx + 1]
        const headingText = inlineToken?.children?.map(t => t.content).join('') ?? ''

        if (headingText) {
          token.attrSet('id', slugify(headingText))
        }
      }

      return renderWithDefault(defaultRender, 'heading_open', tokens, idx, options, env, self)
    }

    rendererRules.paragraph_open = (tokens, idx, options, env, self) => {
      const token = tokens[idx]
      const existingClass = token.attrGet('class')

      if (existingClass?.includes('lead')) {
        token.attrSet('class', existingClass.replace('lead', 'govuk-body-l'))
      } else {
        token.attrSet('class', mergeClasses('govuk-body', existingClass ?? undefined))
      }

      return renderWithDefault(defaultRender, 'paragraph_open', tokens, idx, options, env, self)
    }

    rendererRules.bullet_list_open = (tokens, idx, options, env, self) => {
      const token = tokens[idx]

      token.attrSet(
        'class',
        mergeClasses('govuk-list govuk-list--bullet', token.attrGet('class') ?? undefined),
      )

      return renderWithDefault(defaultRender, 'bullet_list_open', tokens, idx, options, env, self)
    }

    rendererRules.ordered_list_open = (tokens, idx, options, env, self) => {
      const token = tokens[idx]

      token.attrSet(
        'class',
        mergeClasses('govuk-list govuk-list--number', token.attrGet('class') ?? undefined),
      )

      return renderWithDefault(defaultRender, 'ordered_list_open', tokens, idx, options, env, self)
    }

    rendererRules.link_open = (tokens, idx, options, env, self) => {
      const token = tokens[idx]

      token.attrSet('class', mergeClasses('govuk-link', token.attrGet('class') ?? undefined))

      return renderWithDefault(defaultRender, 'link_open', tokens, idx, options, env, self)
    }

    rendererRules.hr = () =>
      '<hr class="govuk-section-break govuk-section-break--l govuk-section-break--visible">\n'

    rendererRules.blockquote_open = () => '<div class="govuk-inset-text">\n'
    rendererRules.blockquote_close = () => '</div>\n'

    rendererRules.table_open = () => '<table class="govuk-table">\n'
    rendererRules.thead_open = () => '<thead class="govuk-table__head">\n'
    rendererRules.tbody_open = () => '<tbody class="govuk-table__body">\n'
    rendererRules.tr_open = () => '<tr class="govuk-table__row">\n'

    rendererRules.th_open = (tokens, idx) => {
      const align = tokens[idx].attrGet('style')

      return align
        ? `<th scope="col" class="govuk-table__header" style="${align}">`
        : '<th scope="col" class="govuk-table__header">'
    }

    rendererRules.td_open = (tokens, idx) => {
      const align = tokens[idx].attrGet('style')

      return align
        ? `<td class="govuk-table__cell" style="${align}">`
        : '<td class="govuk-table__cell">'
    }
  }
}
