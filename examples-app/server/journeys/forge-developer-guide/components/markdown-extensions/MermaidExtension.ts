import type MarkdownIt from 'markdown-it'
import type { Options, Renderer, Token } from 'markdown-it'
import { MarkdownExtension } from './MarkdownExtension'

type RenderRule = (
  tokens: Token[],
  idx: number,
  options: Options,
  env: unknown,
  self: Renderer,
) => string

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export class MermaidExtension extends MarkdownExtension {
  registerPlugin(markdownIt: MarkdownIt): void {
    const rendererRules = markdownIt.renderer.rules
    const baseFence = rendererRules.fence

    if (!baseFence) {
      throw new Error('Mermaid rendering requires a fenced-code renderer')
    }

    rendererRules.fence = (tokens, idx, options, env, self) =>
      this.renderFence(baseFence, tokens, idx, options, env, self)
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
    const [language = ''] = token.info.trim().split(/\s+/)

    if (language !== 'mermaid') {
      return baseFence(tokens, idx, options, env, self)
    }

    return `<div class="forge-mermaid"><pre class="mermaid">${escapeHtml(token.content)}</pre></div>\n`
  }
}
