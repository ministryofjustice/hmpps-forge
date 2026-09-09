import { MarkdownExtension } from './MarkdownExtension'
import type { ContentChunk, ExtensionChunk, RenderMarkdown } from './MarkdownExtension'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface ParamAttrs {
  name: string
  type: string
  required: boolean
  parent?: string
}

/**
 * The `:::param` block: one reference-page parameter, rendered as a
 * signature-rail entry — a code-shaped signature line with a Required/Optional
 * tag, followed by the markdown body.
 *
 * ```
 * :::param
 * ---
 * name: path
 * type: string
 * required: true
 * ---
 * The journey's route path.
 * :::
 * ```
 *
 * Every attribute is explicit: `name`, `type`, and `required` (`true` or
 * `false`) are mandatory and invalid values throw at render time rather than
 * guessing. A `parent` attribute nests the param under the nearest earlier
 * param with that name — nesting can go as deep as the content needs, with
 * each level rendering indented inside its parent's rail and anchors
 * composing down the chain (`param-reachability-resumeWhen`).
 */
export class ParamExtension extends MarkdownExtension {
  readonly containerName = 'param'

  transformChunks(chunks: ContentChunk[]): ContentChunk[] {
    const topLevelChunks: ContentChunk[] = []
    const seenParams: ExtensionChunk[] = []

    chunks.forEach(chunk => {
      if (!this.isParamChunk(chunk)) {
        topLevelChunks.push(chunk)

        return
      }

      const { name, parent } = this.parseAttrs(chunk)

      if (parent) {
        this.findParent(seenParams, parent, name).children.push(chunk)
      } else {
        topLevelChunks.push(chunk)
      }

      seenParams.push(chunk)
    })

    return topLevelChunks
  }

  renderContainer(chunk: ExtensionChunk, renderMarkdown: RenderMarkdown): string {
    return this.renderParam(chunk, renderMarkdown, undefined)
  }

  private renderParam(
    chunk: ExtensionChunk,
    renderMarkdown: RenderMarkdown,
    parentId: string | undefined,
  ): string {
    const { name, type, required } = this.parseAttrs(chunk)
    const id = parentId ? `${parentId}-${name}` : `param-${name}`
    const cssClass = parentId ? 'forge-param forge-param--nested' : 'forge-param'

    const lines = [
      `<div class="${cssClass}" id="${escapeHtml(id)}">`,
      '  <p class="forge-param__signature">',
      `    <span><code class="forge-param__name">${escapeHtml(name)}</code><code class="forge-param__type">: ${escapeHtml(type)}</code></span>`,
      `    ${this.renderRequiredTag(required)}`,
      '  </p>',
      `  <div class="forge-param__body">${renderMarkdown(chunk.body)}</div>`,
    ]

    if (chunk.children.length > 0) {
      lines.push(
        chunk.children.map(child => this.renderParam(child, renderMarkdown, id)).join('\n'),
      )
    }

    lines.push('</div>')

    return lines.join('\n')
  }

  private renderRequiredTag(required: boolean): string {
    return required
      ? '<strong class="app-tag app-tag--red app-tag--small">Required</strong>'
      : '<strong class="app-tag app-tag--grey app-tag--small">Optional</strong>'
  }

  private parseAttrs(chunk: ExtensionChunk): ParamAttrs {
    const { name, type, required, parent } = chunk.attrs

    if (!name) {
      throw new Error('A :::param block is missing "name" in its frontmatter')
    }

    if (!type) {
      throw new Error(`:::param "${name}" is missing "type" in its frontmatter`)
    }

    if (required !== 'true' && required !== 'false') {
      throw new Error(
        `:::param "${name}" must declare "required: true" or "required: false", got "${required ?? ''}"`,
      )
    }

    return { name, type, required: required === 'true', parent }
  }

  private isParamChunk(chunk: ContentChunk): chunk is ExtensionChunk {
    return chunk.kind === 'extension' && chunk.containerName === this.containerName
  }

  // Searches every param seen so far, nested or not, so sub-properties can
  // themselves have sub-properties. The nearest preceding param wins when
  // names repeat, and a param can only name an earlier one as its parent, so
  // cycles are impossible by construction.
  private findParent(
    seenParams: ExtensionChunk[],
    parentName: string,
    childName: string,
  ): ExtensionChunk {
    const parent = seenParams.findLast(chunk => chunk.attrs.name === parentName)

    if (!parent) {
      throw new Error(
        `:::param "${childName}" names parent "${parentName}", but no earlier :::param has that name`,
      )
    }

    return parent
  }
}
