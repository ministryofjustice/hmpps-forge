const fs = require('node:fs')
const path = require('node:path')
const { build } = require('esbuild')
const { sassPlugin } = require('esbuild-sass-plugin')
const nunjucks = require('nunjucks')

function playgroundPlugin() {
  const cwd = process.cwd()
  const sourceDir = path.join(cwd, 'assets/js/playground')
  const declarations = {}

  function collectDeclarations(directory, virtualRoot) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const file = path.join(directory, entry.name)

      if (entry.isDirectory()) {
        collectDeclarations(file, `${virtualRoot}/${entry.name}`)
      } else if (/\.d\.(ts|cts|mts)$/.test(entry.name)) {
        declarations[`${virtualRoot}/${entry.name}`] = fs.readFileSync(file, 'utf8')
      }
    })
  }

  return {
    name: 'forge-playground',
    async generateBundle() {
      const roots = {
        '@ministryofjustice/hmpps-forge': 'node_modules/@ministryofjustice/hmpps-forge/dist',
        zod: 'node_modules/zod',
        '@types/nunjucks': 'node_modules/@types/nunjucks',
        '@types/node': 'node_modules/@types/node',
        'undici-types': 'node_modules/undici-types',
      }

      Object.entries(roots).forEach(([name, directory]) =>
        collectDeclarations(path.join(cwd, directory), `file:///node_modules/${name}`),
      )
      this.emitFile({
        type: 'asset',
        fileName: 'playground/declarations.json',
        source: JSON.stringify(declarations),
      })
      const templateRoot = path.join(cwd, 'node_modules/govuk-frontend/dist')
      const templates = fs
        .readdirSync(path.join(templateRoot, 'govuk'), { recursive: true })
        .filter((name) => name.endsWith('.njk'))
        .map((name) =>
          nunjucks.precompileString(
            fs.readFileSync(path.join(templateRoot, 'govuk', name), 'utf8'),
            { name: `govuk/${name}` },
          ),
        )
      templates.push(
        nunjucks.precompileString(fs.readFileSync(path.join(sourceDir, 'step.njk'), 'utf8'), {
          name: 'playground-step.njk',
        }),
      )

      const result = await build({
        entryPoints: {
          editor: path.join(sourceDir, 'editor.mjs'),
          preview: path.join(sourceDir, 'preview.mjs'),
          'ts.worker': path.join(
            cwd,
            'node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js',
          ),
          'editor.worker': path.join(
            cwd,
            'node_modules/monaco-editor/esm/vs/editor/editor.worker.js',
          ),
        },
        bundle: true,
        write: false,
        outdir: path.join(cwd, 'dist/assets/playground'),
        format: 'esm',
        platform: 'browser',
        minify: true,
        metafile: true,
        loader: { '.ttf': 'dataurl', '.html': 'text' },
        alias: { nunjucks: path.join(cwd, 'node_modules/nunjucks/browser/nunjucks-slim.js') },
        plugins: [
          sassPlugin({ filter: /\.scss$/, embedded: true }),
          {
            name: 'playground-sources',
            setup(buildContext) {
              buildContext.onResolve({ filter: /^virtual:playground-templates$/ }, () => ({
                path: 'templates',
                namespace: 'templates',
              }))
              buildContext.onLoad({ filter: /.*/, namespace: 'templates' }, () => ({
                contents: templates.join('\n'),
                loader: 'js',
              }))
            },
          },
        ],
      })

      Object.keys(result.metafile.inputs)
        .filter((file) => !file.includes(':'))
        .forEach((file) => this.addWatchFile(path.resolve(cwd, file)))
      result.outputFiles.forEach((file) =>
        this.emitFile({
          type: 'asset',
          fileName: `playground/${path.basename(file.path)}`,
          source: file.contents,
        }),
      )
    },
  }
}

module.exports = { playgroundPlugin }
