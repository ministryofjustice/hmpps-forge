// Records highlight.js output on the workspace's own sources, as an oracle for the Rust port.
// Run from rust/:  node highlight-port/samples.cjs > fixtures/highlight.ndjson
// Each source is highlighted in its own language and in every other registered grammar (which
// provokes illegal lexemes and unusual mode paths), with ignoreIllegals true and false.
const fs = require('node:fs')
const path = require('node:path')
const req = require('node:module').createRequire(path.join(__dirname, '../examples-app/package.json'))
const hljs = req('highlight.js/lib/core')
const load = name => req(`highlight.js/lib/languages/${name}`)
const registrations = {
  typescript: 'typescript', javascript: 'javascript', html: 'xml', xml: 'xml', json: 'json',
  bash: 'bash', shell: 'bash', yaml: 'yaml', nunjucks: 'django', njk: 'django', jinja: 'django', jinja2: 'django',
  rust: 'rust',
}
for (const [name, grammar] of Object.entries(registrations)) hljs.registerLanguage(name, load(grammar))

const repo = path.resolve(__dirname, '..')
const byExt = { '.ts': 'typescript', '.mjs': 'javascript', '.js': 'javascript', '.njk': 'nunjucks', '.html': 'html', '.json': 'json', '.yml': 'yaml', '.yaml': 'yaml', '.sh': 'bash', '.rs': 'rust' }
const files = []
const walk = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'target', '.git', 'coverage'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (byExt[path.extname(entry.name)] && fs.statSync(full).size < 12_000) files.push(full)
  }
}
for (const dir of ['examples-app/content', 'examples-app/assets/js', 'examples-app/views', 'forge-moj-components/templates', 'template-parity/corpus', 'highlight-port', 'forge-core/src/authoring', 'forge-topcoat/src', 'forge-devtools/src']) {
  if (fs.existsSync(path.join(repo, dir))) walk(path.join(repo, dir))
}
files.sort()
// A deterministic, bounded sample: every 2nd file in its own language, every 9th in all others.
const languages = ['typescript', 'javascript', 'html', 'json', 'bash', 'yaml', 'nunjucks', 'rust']
const out = []
files.forEach((file, i) => {
  const code = fs.readFileSync(file, 'utf8')
  const own = byExt[path.extname(file)]
  const langs = i % 9 === 0 ? languages : i % 2 === 0 ? [own] : []
  for (const language of langs) {
    for (const ignoreIllegals of [true, false]) {
      const r = hljs.highlight(code, { language, ignoreIllegals })
      out.push(JSON.stringify({ file: path.relative(repo, file), language, ignoreIllegals, code, value: r.value, illegal: !!r.illegal }))
    }
  }
})
process.stdout.write(out.join('\n') + '\n')
