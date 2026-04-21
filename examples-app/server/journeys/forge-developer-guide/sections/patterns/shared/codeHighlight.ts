import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import yaml from 'highlight.js/lib/languages/yaml'
import django from 'highlight.js/lib/languages/django'

hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('nunjucks', django)

export function highlightCode(source: string, language: string): string {
  const lang = hljs.getLanguage(language) ? language : 'plaintext'
  const highlighted =
    lang === 'plaintext'
      ? escapeHtml(source)
      : hljs.highlight(source, { language: lang, ignoreIllegals: true }).value

  return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
