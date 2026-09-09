import { MarkdownExtension } from './MarkdownExtension'
import type { ExtensionChunk } from './MarkdownExtension'

export class PlaygroundExtension extends MarkdownExtension {
  readonly containerName = 'playground'

  renderContainer(chunk: ExtensionChunk): string {
    const { title, base, entry, start } = chunk.attrs
    const files = chunk.body
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
    const isFile = (file: string) =>
      file.endsWith('.ts') &&
      !/\.(test|spec|d)\.ts$/.test(file) &&
      file.split('/').every(part => /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part))

    if (
      !title ||
      !base?.startsWith('/assets/playground/') ||
      !base.endsWith('/') ||
      !base
        .slice('/assets/playground/'.length, -1)
        .split('/')
        .every(part => /^[a-zA-Z0-9_-]+$/.test(part)) ||
      !start ||
      !/^\/(?!\/)[^\\\s]*$/.test(start) ||
      !entry ||
      !files.includes(entry) ||
      !files.length ||
      new Set(files).size !== files.length ||
      !files.every(isFile)
    ) {
      return '<p class="govuk-error-message" role="alert">Invalid playground configuration. Check its settings and file list.</p>'
    }

    const config = JSON.stringify({ title, base, entry, start, files }).replace(/</g, '\\u003c')

    return `<script type="application/json" data-playground>${config}</script>`
  }
}
