import type MarkdownIt from 'markdown-it'
import type { Options, Renderer, Token } from 'markdown-it'
import type { CodeStepAnnotation } from './HighlightedCodeDecorator'
import { HighlightedCodeDecorator } from './HighlightedCodeDecorator'
import { MarkdownExtension } from './MarkdownExtension'

type RenderRule = (
  tokens: Token[],
  idx: number,
  options: Options,
  env: unknown,
  self: Renderer,
) => string

export class CodeStepExtension extends MarkdownExtension {
  private static readonly maxStep = 10

  registerPlugin(markdownIt: MarkdownIt): void {
    const rendererRules = markdownIt.renderer.rules
    const baseFence = rendererRules.fence

    if (!baseFence) {
      throw new Error('Code-step highlighting requires a fenced-code renderer')
    }

    rendererRules.fence = (tokens, idx, options, env, self) =>
      this.renderFence(baseFence, tokens, idx, options, env, self)

    markdownIt.core.ruler.after('inline', 'forge_code_steps', state => {
      state.tokens.forEach(token => {
        if (token.children) {
          this.transformInlineCodeSteps(token.children)
        }
      })
    })
  }

  private renderFence(
    baseFence: RenderRule,
    tokens: Token[],
    idx: number,
    options: Options,
    env: unknown,
    self: Renderer,
  ): string {
    const token = tokens[idx]
    const annotations = this.parseAnnotations(token.info, token.content)
    const renderedFence = baseFence(tokens, idx, options, env, self)

    if (annotations.length === 0) {
      return renderedFence
    }

    return this.decorateRenderedFence(renderedFence, token.content, annotations)
  }

  private parseAnnotations(info: string, source: string): CodeStepAnnotation[] {
    if (!info.includes('[[')) {
      return []
    }

    const metadataMatch = /(\[\[.*\]\])/.exec(info)

    if (!metadataMatch) {
      throw new Error('Code-step metadata must be a complete JSON array')
    }

    let metadata: unknown

    try {
      metadata = JSON.parse(metadataMatch[1])
    } catch (error) {
      throw new Error('Code-step metadata must be valid JSON', { cause: error })
    }

    if (!Array.isArray(metadata)) {
      throw new Error('Code-step metadata must be an array of annotation tuples')
    }

    const lines = source.split('\n')
    const lineStarts: number[] = []
    let lineStart = 0

    lines.forEach(line => {
      lineStarts.push(lineStart)
      lineStart += line.length + 1
    })

    const annotations = metadata.map((value, index) =>
      this.parseAnnotation(value, index, lines, lineStarts),
    )

    return this.sortAndValidateAnnotations(annotations)
  }

  private parseAnnotation(
    value: unknown,
    index: number,
    lines: readonly string[],
    lineStarts: readonly number[],
  ): CodeStepAnnotation {
    if (!Array.isArray(value) || value.length < 3 || value.length > 4) {
      throw new Error(`Code-step annotation ${index + 1} must be [step, line, text, fromIndex?]`)
    }

    const [step, lineNumber, text, fromIndex] = value

    if (!this.isIntegerInRange(step, 1, CodeStepExtension.maxStep)) {
      throw new Error(
        `Code-step annotation ${index + 1} must use a step between 1 and ${CodeStepExtension.maxStep}`,
      )
    }

    if (!this.isIntegerInRange(lineNumber, 1, lines.length)) {
      throw new Error(`Code-step annotation ${index + 1} refers to invalid line ${lineNumber}`)
    }

    if (typeof text !== 'string' || text.length === 0) {
      throw new Error(`Code-step annotation ${index + 1} must include non-empty text`)
    }

    if (fromIndex !== undefined && !this.isIntegerInRange(fromIndex, 0, Number.MAX_SAFE_INTEGER)) {
      throw new Error(`Code-step annotation ${index + 1} has an invalid fromIndex`)
    }

    const line = lines[lineNumber - 1]
    const firstIndex = line.indexOf(text)
    const lastIndex = line.lastIndexOf(text)

    if (firstIndex === -1) {
      throw new Error(`Could not find ${JSON.stringify(text)} on code line ${lineNumber}`)
    }

    if (firstIndex !== lastIndex && fromIndex === undefined) {
      throw new Error(
        `Found ${JSON.stringify(text)} more than once on code line ${lineNumber}; provide fromIndex as the fourth tuple value`,
      )
    }

    const column = fromIndex === undefined ? firstIndex : line.indexOf(text, fromIndex)

    if (column === -1) {
      throw new Error(
        `Could not find ${JSON.stringify(text)} on code line ${lineNumber} from index ${fromIndex}`,
      )
    }

    const start = lineStarts[lineNumber - 1] + column

    return { step, start, end: start + text.length }
  }

  private sortAndValidateAnnotations(
    annotations: readonly CodeStepAnnotation[],
  ): CodeStepAnnotation[] {
    const sorted = [...annotations].sort((left, right) => left.start - right.start)

    sorted.forEach((annotation, index) => {
      const previous = sorted[index - 1]

      if (previous && annotation.start < previous.end) {
        throw new Error('Code-step annotations cannot overlap')
      }
    })

    return sorted
  }

  private decorateRenderedFence(
    renderedFence: string,
    source: string,
    annotations: readonly CodeStepAnnotation[],
  ): string {
    const codeOpen = renderedFence.indexOf('<code')
    const contentStart = renderedFence.indexOf('>', codeOpen) + 1
    const contentEnd = renderedFence.lastIndexOf('</code>')

    if (codeOpen === -1 || contentStart === 0 || contentEnd < contentStart) {
      throw new Error('Code-step highlighting could not find the rendered code element')
    }

    const highlightedHtml = renderedFence.slice(contentStart, contentEnd)
    const decoratedHtml = new HighlightedCodeDecorator(
      source,
      highlightedHtml,
      annotations,
    ).render()

    return `${renderedFence.slice(0, contentStart)}${decoratedHtml}${renderedFence.slice(contentEnd)}`
  }

  private transformInlineCodeSteps(tokens: readonly Token[]): void {
    const openSteps: number[] = []

    tokens.forEach(token => {
      if (token.type !== 'html_inline') {
        return
      }

      const openingMatch = /^<s(\d+)>$/.exec(token.content)
      const openingStep = Number(openingMatch?.[1])

      if (openingMatch && this.isIntegerInRange(openingStep, 1, CodeStepExtension.maxStep)) {
        if (openSteps.length > 0) {
          throw new Error('Code step markers cannot be nested')
        }

        const codeStepToken = token

        openSteps.push(openingStep)
        codeStepToken.content = `<span class="app-code-step app-code-step--${openingStep}" data-step="${openingStep}">`

        return
      }

      const closingMatch = /^<\/s(\d+)>$/.exec(token.content)
      const closingStep = Number(closingMatch?.[1])

      if (closingMatch && this.isIntegerInRange(closingStep, 1, CodeStepExtension.maxStep)) {
        if (!openSteps.pop()) {
          throw new Error('Code step has a closing tag without an opening tag')
        }

        const codeStepToken = token

        codeStepToken.content = '</span>'
      }
    })

    if (openSteps.length > 0) {
      throw new Error('Code step has an opening tag without a closing tag')
    }
  }

  private isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
    return (
      typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
    )
  }
}
