// Builds the parity corpus: every govuk-frontend fixture plus hand-written MOJ cases,
// each rendered through real Nunjucks (the reference the Rust side is diffed against).
//
// Usage (from rust/): TZ=UTC node template-parity/corpus/generate.mjs > template-parity/corpus/corpus.json
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
// The Rust examples app's npm packages (rust/examples-app: `npm ci` there).
const require = createRequire(join(here, '../../examples-app/package.json'))
const nunjucks = require('nunjucks')

const govukRoot = dirname(require.resolve('govuk-frontend/package.json'))
const mojRoot = dirname(require.resolve('@ministryofjustice/frontend/package.json'))
const searchPaths = [join(govukRoot, 'dist'), mojRoot]

// Same environment options the Forge express-nunjucks adapter uses.
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(searchPaths), { autoescape: true })
// Same filters examples-app registers (mojDate, date).
for (const [name, filter] of Object.entries(require('@ministryofjustice/frontend/moj/filters/all.js')())) {
  env.addFilter(name, filter)
}

const macroName = (macroFile) => /\{%-?\s*macro\s+(\w+)/.exec(readFileSync(macroFile, 'utf8'))[1]

// Shared with the Rust harness: both sides must build the exact same wrapper source.
const wrapperSource = (template, name, caller) =>
  caller == null
    ? `{%- from "${template}" import ${name} -%}{{ ${name}(params) }}`
    : `{%- from "${template}" import ${name} -%}{% call ${name}(params) %}${caller}{% endcall %}`

const render = (template, name, params, caller) => {
  const src = wrapperSource(template, name, caller)
  try {
    return { ok: true, html: env.renderString(src, { params }) }
  } catch (e) {
    return { ok: false, error: String(e.message ?? e) }
  }
}

const cases = []

// GOV.UK: fixtures ship with the package.
const govukComponents = join(govukRoot, 'dist/govuk/components')
for (const component of readdirSync(govukComponents)) {
  const fixturesFile = join(govukComponents, component, 'fixtures.json')
  if (!existsSync(fixturesFile)) continue
  const template = `govuk/components/${component}/macro.njk`
  const macro = macroName(join(govukComponents, component, 'macro.njk'))
  for (const f of JSON.parse(readFileSync(fixturesFile, 'utf8')).fixtures) {
    cases.push({
      id: `govuk/${component}/${f.name}`,
      library: 'govuk',
      component,
      template,
      macro,
      params: f.options,
      caller: null,
      source: wrapperSource(template, macro, null),
      fixtureHtml: f.html,
      nunjucks: render(template, macro, f.options),
    })
  }
}

// MOJ: no fixtures ship, so cases are hand-written in moj-cases.json.
const mojCases = JSON.parse(readFileSync(join(here, 'moj-cases.json'), 'utf8'))
for (const [component, variants] of Object.entries(mojCases)) {
  const template = `moj/components/${component}/macro.njk`
  const macro = macroName(join(mojRoot, template))
  for (const [name, { __caller: caller = null, ...params }] of Object.entries(variants)) {
    cases.push({
      id: `moj/${component}/${name}`,
      library: 'moj',
      component,
      template,
      macro,
      params,
      caller,
      source: wrapperSource(template, macro, caller),
      fixtureHtml: null,
      nunjucks: render(template, macro, params, caller),
    })
  }
}

// Search paths relative to the rust/ workspace, so the corpus is not tied to a checkout location.
const workspace = join(here, '../..')
process.stdout.write(JSON.stringify({ searchPaths: searchPaths.map(p => relative(workspace, p)), cases }, null, 1))
