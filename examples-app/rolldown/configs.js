const { playgroundPlugin } = require('./playgroundPlugin')
const sassPlugin = require('rollup-plugin-sass')
const sass = require('sass-embedded')
const path = require('node:path')
const { styleText } = require('node:util')

const { cleanPlugin, copyPlugin, liveReloadPlugin, manifestPlugin, typecheckPlugin, nunjucksPrecompilePlugin } = require('./plugins')

const cwd = process.cwd()
const isProduction = process.env.NODE_ENV === 'production'
const isWatch = process.argv.includes('--watch')
const liveReloadPort = 35729

function getAppConfig() {
  const outDir = path.join(cwd, 'dist')
  const serverDir = path.join(cwd, 'server')
  const shared = {
    external: id => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0'),
    resolve: {
      tsconfigFilename: path.join(cwd, 'tsconfig.json'),
    },
    output: {
      dir: outDir,
      format: 'cjs',
      sourcemap: true,
    },
    watch: {
      include: [path.join(serverDir, '**')],
      clearScreen: false,
    },
  }

  return [
    {
      ...shared,
      input: path.join(serverDir, 'server.ts'),
      output: { ...shared.output, entryFileNames: '[name].js' },
      plugins: [
        cleanPlugin(outDir, { exclude: ['assets'], excludeExtensions: ['.js', '.js.map'] }),
        copyPlugin({
          patterns: [
            path.join(serverDir, '**/*.njk'),
            path.join(serverDir, '**/*.md'),
            path.join(serverDir, 'journeys/forge-developer-guide/sections/patterns/**/*.ts'),
            path.join(serverDir, 'journeys/forge-developer-guide/components/**/*.ts'),
          ],
          baseDir: serverDir,
          outDir,
        }),
        typecheckPlugin({ prefix: styleText(['bold', 'cyan'], '[TSC]') }),
      ],
    },
    {
      ...shared,
      input: path.join(serverDir, 'data/embeddings/embeddingWorker.ts'),
      output: { ...shared.output, entryFileNames: '[name].js' },
    },
  ]
}

function getAssetsConfig() {
  const assetsDir = path.join(cwd, 'assets')
  const outDir = path.join(cwd, 'dist/assets')

  const demoDir = path.join(assetsDir, 'js/browser-forge-demo')

  return {
    // Two browser entries need real chunk sharing, which iife cannot do - the
    // layout already loads the bundle with type="module", so esm is safe.
    external: ['/assets/playground/editor.js'],
    input: {
      index: path.join(assetsDir, 'js/index.js'),
      'browser-forge-demo': path.join(demoDir, 'index.mjs'),
    },
    output: {
      dir: outDir,
      format: 'esm',
      sourcemap: !isProduction,
      minify: isProduction,
      entryFileNames: isProduction ? 'js/[name].[hash].js' : 'js/[name].js',
      chunkFileNames: isProduction ? 'js/[name].[hash].js' : 'js/[name].js',
      assetFileNames: isProduction ? '[name].[hash][extname]' : '[name][extname]',
    },
    platform: 'browser',
    resolve: {
      alias: {
        // Nunjucks swaps to the slim build: runtime only, no compiler,
        // precompiled templates.
        nunjucks: path.join(cwd, 'node_modules/nunjucks/browser/nunjucks-slim.js'),
      },
    },
    plugins: [
      cleanPlugin(outDir),
      nunjucksPrecompilePlugin({
        virtualId: 'virtual:browser-forge-demo-templates',
        root: path.join(cwd, 'node_modules/govuk-frontend/dist'),
        // Only what the demo journeys render plus the include closure those
        // templates pull in (label, hint, error-message, fieldset,
        // attributes) - a folder is the component's whole template set, a
        // .njk path a single template. A missing one fails loudly in e2e.
        templates: [
          'govuk/components/breadcrumbs',
          'govuk/components/button',
          'govuk/components/error-message',
          'govuk/components/error-summary',
          'govuk/components/fieldset',
          'govuk/components/hint',
          'govuk/components/input',
          'govuk/components/inset-text',
          'govuk/components/label',
          'govuk/components/radios',
          'govuk/components/select',
          'govuk/components/summary-list',
          'govuk/macros/attributes.njk',
        ],
        files: [
          { file: path.join(demoDir, 'templates/browser-app-step.njk'), name: 'browser-app-step.njk' },
          { file: path.join(demoDir, 'templates/browser-app-error.njk'), name: 'browser-app-error.njk' },
        ],
      }),
      sassPlugin({
        runtime: sass,
        api: 'modern',
        output: path.join(outDir, 'css/index.css'),
        options: {
          style: isProduction ? 'compressed' : 'expanded',
          loadPaths: [cwd, path.join(cwd, 'node_modules')],
          silenceDeprecations: ['import'],
          quietDeps: true,
          sourceMap: !isProduction,
        },
      }),
      copyPlugin({
        patterns: [path.join(assetsDir, 'images/**/*')],
        baseDir: assetsDir,
        outDir,
      }),
      playgroundPlugin(),
      manifestPlugin(outDir),
      ...(isWatch ? [liveReloadPlugin({ port: liveReloadPort })] : []),
    ],
    watch: {
      include: [path.join(assetsDir, '**')],
      clearScreen: false,
    },
  }
}

module.exports = { getAppConfig, getAssetsConfig, liveReloadPort }
