import type MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import yaml from 'highlight.js/lib/languages/yaml'
import django from 'highlight.js/lib/languages/django'
import { MarkdownExtension } from './MarkdownExtension'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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

export class CodeBlockExtension extends MarkdownExtension {
  registerPlugin(markdownIt: MarkdownIt): void {
    const rendererRules = markdownIt.renderer.rules

    rendererRules.fence = (tokens, idx) => {
      const token = tokens[idx]
      const info = token.info ? token.info.trim() : ''
      const [lang = ''] = info.split(/\s+/)
      const codeHtml = this.highlightCode(token.content, lang)

      return `<div class="app-code-block">${codeHtml}</div>\n`
    }
  }

  private highlightCode(content: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      return `<pre><code class="hljs language-${lang}">${hljs.highlight(content, { language: lang }).value}</code></pre>`
    }

    if (lang) {
      return `<pre><code class="language-${lang}">${escapeHtml(content)}</code></pre>`
    }

    return `<pre><code>${escapeHtml(content)}</code></pre>`
  }
}
