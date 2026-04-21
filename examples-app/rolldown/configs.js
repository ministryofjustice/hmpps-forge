const sassPlugin = require('rollup-plugin-sass')
const sass = require('sass-embedded')
const path = require('node:path')
const { styleText } = require('node:util')

const { cleanPlugin, copyPlugin, manifestPlugin, typecheckPlugin } = require('./plugins')

const cwd = process.cwd()
const isProduction = process.env.NODE_ENV === 'production'
const isWatch = process.argv.includes('--watch')

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

  return {
    input: path.join(assetsDir, 'js/index.js'),
    output: {
      dir: outDir,
      format: 'iife',
      sourcemap: !isProduction,
      entryFileNames: isProduction ? 'js/[name].[hash].js' : 'js/[name].js',
      assetFileNames: isProduction ? '[name].[hash][extname]' : '[name][extname]',
    },
    platform: 'browser',
    minify: isProduction,
    plugins: [
      cleanPlugin(outDir),
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
      manifestPlugin(outDir),
    ],
    watch: {
      include: [path.join(assetsDir, '**')],
      clearScreen: false,
    },
  }
}

module.exports = { getAppConfig, getAssetsConfig }
