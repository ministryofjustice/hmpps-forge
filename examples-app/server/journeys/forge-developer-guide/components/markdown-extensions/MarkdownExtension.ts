import type MarkdownIt from 'markdown-it'

export interface MarkdownChunk {
  kind: 'markdown'
  content: string
}

export interface ExtensionChunk {
  kind: 'extension'
  containerName: string
  attrs: Record<string, string>
  body: string
  children: ExtensionChunk[]
}

export type ContentChunk = MarkdownChunk | ExtensionChunk

export type RenderMarkdown = (markdown: string) => string

export abstract class MarkdownExtension {
  registerPlugin?(markdownIt: MarkdownIt): void

  readonly containerName?: string
  transformChunks?(chunks: ContentChunk[]): ContentChunk[]
  renderContainer?(chunk: ExtensionChunk, renderMarkdown: RenderMarkdown): string
}
