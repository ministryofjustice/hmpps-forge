import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import scss from 'highlight.js/lib/languages/scss'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import plaintext from 'highlight.js/lib/languages/plaintext'

import { buildComponent } from '@form-engine/registry/utils/buildComponent'
import { BlockDefinition, ConditionalString, EvaluatedBlock } from '@form-engine/form/types/structures.type'

// Register languages for SSR highlighting
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('scss', scss)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('plaintext', plaintext)

/**
 * Supported programming languages for syntax highlighting.
 * These map to highlight.js language identifiers.
 */
export type CodeLanguage =
  | 'typescript'
  | 'javascript'
  | 'html'
  | 'css'
  | 'scss'
  | 'json'
  | 'bash'
  | 'shell'
  | 'yaml'
  | 'markdown'
  | 'plaintext'

/**
 * Code Block component for displaying syntax-highlighted code.
 *
 * Renders code with server-side syntax highlighting via highlight.js.
 * The HTML is pre-highlighted during SSR - no client-side JS required.
 *
 * @example
 * ```typescript
 * block<CodeBlock>({
 *   variant: 'codeBlock',
 *   language: 'typescript',
 *   code: `journey({
 *     code: 'my-form',
 *     title: 'My Form',
 *     path: '/my-form',
 *   })`,
 * })
 * ```
 */
export interface CodeBlock extends BlockDefinition {
  variant: 'codeBlock'

  /** The code to display */
  code: ConditionalString

  /** Programming language for syntax highlighting (defaults to 'typescript') */
  language?: CodeLanguage

  /** Optional title displayed above the code block */
  title?: ConditionalString

  /** Additional CSS classes for the container */
  classes?: ConditionalString
}

/**
 * Escapes HTML entities for text that won't be highlighted.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Renders the code block component with SSR syntax highlighting.
 */
export const codeBlock = buildComponent<CodeBlock>('codeBlock', async (block: EvaluatedBlock<CodeBlock>) => {
  const language = block.language || 'typescript'
  const containerClasses = ['code-block', block.classes].filter(Boolean).join(' ')

  // Trim leading/trailing newlines that occur from template literal formatting
  const code = block.code.replace(/^\n/, '').replace(/\n\s*$/, '')

  // Apply syntax highlighting server-side
  let highlightedCode: string

  try {
    const result = hljs.highlight(code, { language })
    highlightedCode = result.value
  } catch {
    // Fallback to escaped plain text if highlighting fails
    highlightedCode = escapeHtml(code)
  }

  let html = ''

  if (block.title) {
    html += `<p class="govuk-body-s govuk-!-margin-bottom-1"><strong>${escapeHtml(block.title)}</strong></p>\n`
  }

  // Wrap in custom element for copy button
  html += `<app-copy-code class="app-code-block">`
  html += `<pre class="${containerClasses}"><code class="hljs language-${language}">${highlightedCode}</code></pre>`
  html += `</app-copy-code>`

  return html
})
