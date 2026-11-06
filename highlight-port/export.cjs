// Exports highlight.js grammars *as highlight.js compiles them* (mode graph after compileLanguage),
// for the Rust engine in examples-app/src/highlight/, from the highlight.js installed in
// rust/examples-app (`npm ci` there). Run from rust/:
//   node highlight-port/export.cjs > examples-app/src/highlight/grammars.json
// The languages the guide highlights: the TS app's set, plus Rust.
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

// Compile every registered language (compileLanguage mutates the language's mode tree).
for (const name of Object.keys(registrations)) hljs.highlight('x', { language: name, ignoreIllegals: true })

const src = re => (re == null ? null : typeof re === 'string' ? re : re.source)
const CALLBACKS = [
  ['skipIfHasPrecedingDot', /const before = match\.input\[match\.index - 1\]/],
  ['shebang', /if \(m\.index !== 0\) resp\.ignoreMatch\(\)/],
  ['endSameAsBeginStart', /resp\.data\._beginMatch = m\[1\]/],
  ['endSameAsBeginEnd', /resp\.data\._beginMatch !== m\[1\]/],
  ['isTrulyOpeningTag', /nextChar === "<"/],
]
const callbackName = fn => {
  if (!fn) return null
  const text = fn.toString()
  const hit = CALLBACKS.find(([, re]) => re.test(text))
  if (!hit) throw new Error(`unknown callback: ${text.slice(0, 200)}`)
  return hit[0]
}
const scopeObj = s => {
  if (s == null) return null
  const out = {}
  for (const [k, v] of Object.entries(s)) out[k] = v
  if (s._emit) out._emit = Object.keys(s._emit).map(Number)
  if (s._multi) out._multi = true
  return out
}

const ids = new Map()
const modes = []
const visit = mode => {
  if (ids.has(mode)) return ids.get(mode)
  const id = modes.length
  ids.set(mode, id)
  modes.push(null)
  const kw = mode.keywords ? Object.fromEntries(Object.entries(mode.keywords)) : null
  const out = {
    scope: typeof mode.scope === 'string' ? mode.scope : null,
    beginScope: scopeObj(mode.beginScope),
    endScope: scopeObj(mode.endScope),
    begin: src(mode.begin),
    end: src(mode.end),
    terminatorEnd: mode.terminatorEnd ?? null,
    illegal: src(mode.illegal),
    keywords: kw,
    keywordPattern: src(mode.keywordPatternRe),
    returnBegin: !!mode.returnBegin, returnEnd: !!mode.returnEnd,
    excludeBegin: !!mode.excludeBegin, excludeEnd: !!mode.excludeEnd,
    endsWithParent: !!mode.endsWithParent, endsParent: !!mode.endsParent, skip: !!mode.skip,
    subLanguage: mode.subLanguage ?? null,
    relevance: mode.relevance ?? 1,
    beforeBegin: callbackName(mode.__beforeBegin),
    onBegin: callbackName(mode['on:begin']),
    onEnd: callbackName(mode['on:end']),
    contains: [],
    starts: null,
  }
  modes[id] = out
  out.contains = mode.contains.map(visit)
  if (mode.starts) out.starts = visit(mode.starts)
  return id
}

const languages = {}
for (const name of Object.keys(registrations)) {
  const lang = hljs.getLanguage(name)
  languages[name] = {
    root: visit(lang),
    caseInsensitive: !!lang.case_insensitive,
    unicodeRegex: !!lang.unicodeRegex,
    classNameAliases: Object.fromEntries(Object.entries(lang.classNameAliases || {})),
  }
}
// `registerAliases`: each registration's grammar aliases, later registrations winning.
const aliases = {}
for (const name of Object.keys(registrations)) {
  for (const alias of hljs.getLanguage(name).aliases || []) aliases[alias.toLowerCase()] = name
}
process.stdout.write(JSON.stringify({ version: hljs.versionString, languages, aliases, modes }))
