export interface CodeStepAnnotation {
  readonly step: number
  readonly start: number
  readonly end: number
}

export class HighlightedCodeDecorator {
  private static readonly htmlEntities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
  }

  private readonly output: string[] = []

  private readonly syntaxSpans: string[] = []

  private sourceOffset = 0

  private annotationIndex = 0

  private activeAnnotation: CodeStepAnnotation | undefined

  constructor(
    private readonly source: string,
    private readonly highlightedHtml: string,
    private readonly annotations: readonly CodeStepAnnotation[],
  ) {}

  render(): string {
    const htmlTokens =
      this.highlightedHtml.match(
        /<span class="[^"]*">|<\/span>|&(?:amp|lt|gt|quot|#39|#x27);|[\s\S]/g,
      ) ?? []

    htmlTokens.forEach(htmlToken => {
      this.applyAnnotationBoundary()
      this.renderHtmlToken(htmlToken)
    })
    this.applyAnnotationBoundary()
    this.assertComplete()

    return this.output.join('')
  }

  private renderHtmlToken(htmlToken: string): void {
    if (/^<span class="[^"]*">$/.test(htmlToken)) {
      this.syntaxSpans.push(htmlToken)
      this.output.push(htmlToken)

      return
    }

    if (htmlToken === '</span>') {
      if (!this.syntaxSpans.pop()) {
        throw new Error('Highlighted code contains an unmatched closing span')
      }

      this.output.push(htmlToken)

      return
    }

    const sourceText = HighlightedCodeDecorator.htmlEntities[htmlToken] ?? htmlToken
    const expectedText = this.source.slice(this.sourceOffset, this.sourceOffset + sourceText.length)

    if (sourceText !== expectedText) {
      throw new Error('Highlighted code no longer matches its source text')
    }

    this.output.push(htmlToken)
    this.sourceOffset += sourceText.length
  }

  private applyAnnotationBoundary(): void {
    const shouldClose = this.activeAnnotation?.end === this.sourceOffset
    const nextAnnotation = this.annotations[this.annotationIndex]
    const shouldOpen = nextAnnotation?.start === this.sourceOffset

    if (!shouldClose && !shouldOpen) {
      return
    }

    this.closeSyntaxSpans()

    if (shouldClose) {
      this.output.push('</span>')
      this.activeAnnotation = undefined
    }

    if (shouldOpen) {
      this.output.push(
        `<span class="app-code-step app-code-step--${nextAnnotation.step}" data-step="${nextAnnotation.step}">`,
      )
      this.activeAnnotation = nextAnnotation
      this.annotationIndex += 1
    }

    this.reopenSyntaxSpans()
  }

  private closeSyntaxSpans(): void {
    this.syntaxSpans.forEach(() => this.output.push('</span>'))
  }

  private reopenSyntaxSpans(): void {
    this.syntaxSpans.forEach(syntaxSpan => this.output.push(syntaxSpan))
  }

  private assertComplete(): void {
    if (this.sourceOffset !== this.source.length) {
      throw new Error('Highlighted code ended before its source text')
    }

    if (this.syntaxSpans.length > 0) {
      throw new Error('Highlighted code contains an unclosed syntax span')
    }

    if (this.activeAnnotation || this.annotationIndex !== this.annotations.length) {
      throw new Error('A code-step annotation could not be applied to the highlighted code')
    }
  }
}
