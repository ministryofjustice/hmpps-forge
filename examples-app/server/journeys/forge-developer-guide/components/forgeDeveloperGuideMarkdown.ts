import { component } from '@ministryofjustice/hmpps-forge/core/components'
import type { BlockDefinition, RenderedBlock } from '@ministryofjustice/hmpps-forge/core/components'
import type MarkdownIt from 'markdown-it'
import createMarkdownIt from 'markdown-it'
import markdownItAttrs from 'markdown-it-attrs'
import { CodeBlockExtension } from './markdown-extensions/CodeBlockExtension'
import { CodeStepExtension } from './markdown-extensions/CodeStepExtension'
import { DeepDiveExtension } from './markdown-extensions/DeepDiveExtension'
import { FrameSequenceExtension } from './markdown-extensions/FrameSequenceExtension'
import { GovUKStyleExtension } from './markdown-extensions/GovUKStyleExtension'
import { MarkdownExtension } from './markdown-extensions/MarkdownExtension'
import type { ContentChunk, ExtensionChunk } from './markdown-extensions/MarkdownExtension'
import { MermaidExtension } from './markdown-extensions/MermaidExtension'
import { NoteExtension } from './markdown-extensions/NoteExtension'
import { ParamExtension } from './markdown-extensions/ParamExtension'
import { PlaygroundExtension } from './markdown-extensions/PlaygroundExtension'
import { PreviewExtension } from './markdown-extensions/PreviewExtension'

export class GuideMarkdownRenderer {
  private readonly markdownIt: MarkdownIt

  private readonly extensionsByName: Map<string, MarkdownExtension>

  constructor(
    private readonly extensions: MarkdownExtension[],
    createBaseMarkdownIt: () => MarkdownIt = () => {
      const md = createMarkdownIt({ html: true, breaks: false, linkify: true })
      md.use(markdownItAttrs, {
        leftDelimiter: '{',
        rightDelimiter: '}',
        allowedAttributes: ['class', 'id', 'style'],
      })

      return md
    },
  ) {
    this.markdownIt = createBaseMarkdownIt()
    extensions.forEach(ext => ext.registerPlugin?.(this.markdownIt))

    this.extensionsByName = new Map(
      extensions
        .filter(ext => ext.containerName && ext.renderContainer)
        .map(ext => [ext.containerName!, ext]),
    )
  }

  render(markdown: string): string {
    const parsed = this.parseChunks(markdown)
    const chunks = this.extensions.reduce(
      (transformed, extension) => extension.transformChunks?.(transformed) ?? transformed,
      parsed as ContentChunk[],
    )

    return chunks.map(chunk => this.renderChunk(chunk)).join('')
  }

  getPreviewSlotNames(markdown: string): string[] {
    return [
      ...new Set(
        this.parseChunks(markdown).flatMap(chunk =>
          chunk.kind === 'extension' && chunk.containerName === 'preview' ? [chunk.attrs.slot] : [],
        ),
      ),
    ]
  }

  private renderChunk(chunk: ContentChunk): string {
    if (chunk.kind === 'markdown') {
      return this.markdownIt.render(chunk.content)
    }

    const extension = this.extensionsByName.get(chunk.containerName)

    if (!extension) {
      throw new Error(`No markdown extension registered for ":::${chunk.containerName}"`)
    }

    return extension.renderContainer!(chunk, body => this.markdownIt.render(body))
  }

  private parseChunks(markdown: string): ContentChunk[] {
    const lines = markdown.trim().split('\n')
    const chunks: ContentChunk[] = []
    const markdownLines: string[] = []
    let index = 0
    let codeFence: string | undefined

    while (index < lines.length) {
      const fence = lines[index].match(/^ {0,3}(`{3,}|~{3,})/)
      const insideCodeFence = Boolean(codeFence || fence)

      if (insideCodeFence) {
        if (!codeFence) {
          codeFence = fence?.[1]
        } else if (
          fence &&
          fence[1][0] === codeFence[0] &&
          fence[1].length >= codeFence.length &&
          lines[index].trim() === fence[1]
        ) {
          codeFence = undefined
        }
      }

      const extensionBlock = insideCodeFence ? undefined : this.parseExtensionBlock(lines, index)

      if (extensionBlock) {
        this.appendMarkdownChunk(chunks, markdownLines)
        markdownLines.length = 0
        chunks.push(extensionBlock.chunk)
        index = extensionBlock.nextIndex
      } else {
        markdownLines.push(lines[index])
        index += 1
      }
    }

    this.appendMarkdownChunk(chunks, markdownLines)

    return chunks
  }

  // A block is `:::<registered name>`, an immediate `---`-fenced frontmatter
  // section, a markdown body, and a closing fence matching the colon run that
  // opened it. Four colons open a block whose body may itself contain `:::`
  // blocks, since those inner fences no longer match the opener. Anything that
  // doesn't parse completely falls through as plain markdown, matching the
  // original guide's deep-dive behaviour, so a malformed block is visible on
  // the page rather than silently swallowed.
  private parseExtensionBlock(
    lines: string[],
    startIndex: number,
  ): { chunk: ExtensionChunk; nextIndex: number } | undefined {
    const containerMatch = lines[startIndex].trim().match(/^(:{3,4})([a-z0-9-]+)$/)

    if (!containerMatch || !this.extensionsByName.has(containerMatch[2])) {
      return undefined
    }

    const frontmatterStart = startIndex + 1

    if (lines[frontmatterStart]?.trim() !== '---') {
      return undefined
    }

    const frontmatterEnd = lines.findIndex(
      (line, index) => index > frontmatterStart && line.trim() === '---',
    )

    if (frontmatterEnd === -1) {
      return undefined
    }

    const blockEnd = lines.findIndex(
      (line, index) => index > frontmatterEnd && line.trim() === containerMatch[1],
    )

    if (blockEnd === -1) {
      return undefined
    }

    return {
      chunk: {
        kind: 'extension',
        containerName: containerMatch[2],
        attrs: this.parseFrontmatterAttrs(lines.slice(frontmatterStart + 1, frontmatterEnd)),
        body: lines
          .slice(frontmatterEnd + 1, blockEnd)
          .join('\n')
          .trim(),
        children: [],
      },
      nextIndex: blockEnd + 1,
    }
  }

  private parseFrontmatterAttrs(lines: string[]): Record<string, string> {
    return Object.fromEntries(
      lines.flatMap(line => {
        const colon = line.indexOf(':')

        if (colon === -1) {
          return []
        }

        const key = line.slice(0, colon).trim()
        const value = line.slice(colon + 1).trim()

        if (!key) {
          return []
        }

        // Values are taken verbatim - no quote stripping - so types like
        // `'entry' | 'frontier'` survive intact.
        return [[key, value]]
      }),
    )
  }

  private appendMarkdownChunk(chunks: ContentChunk[], lines: string[]): void {
    const content = lines.join('\n').trim()

    if (content) {
      chunks.push({ kind: 'markdown', content })
    }
  }
}

const guideMarkdownRenderer = new GuideMarkdownRenderer([
  new GovUKStyleExtension(),
  new CodeBlockExtension(),
  new MermaidExtension(),
  new CodeStepExtension(),
  new DeepDiveExtension(),
  new FrameSequenceExtension(),
  new NoteExtension(),
  new ParamExtension(),
  new PlaygroundExtension(),
  new PreviewExtension(),
])

export function renderForgeDeveloperGuideMarkdown(markdown: string): string {
  return guideMarkdownRenderer.render(markdown)
}

export function readForgeDeveloperGuidePreviewSlots(markdown: string): string[] {
  return guideMarkdownRenderer.getPreviewSlotNames(markdown)
}

export interface ForgeDeveloperGuideMarkdownBlock {
  content: string
  slots?: Record<string, BlockDefinition[]>
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

export const ForgeDeveloperGuideMarkdownBlock = component<ForgeDeveloperGuideMarkdownBlock>(
  'forgeDeveloperGuideMarkdown',
  {
    factory: () => block => {
      if (!block.content) {
        return ''
      }

      const markdown = block.slots ? replaceSlotMarkers(block.content) : block.content
      let html = renderForgeDeveloperGuideMarkdown(markdown)

      if (block.slots) {
        html = replaceSlotPlaceholders(html, block.slots)
      }

      return html
    },
  },
)
