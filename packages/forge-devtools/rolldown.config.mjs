import * as fs from 'node:fs'
import * as sass from 'sass'
import { copyAssets } from '../rolldown.shared.mjs'

const pluginFiles = {
  background: 'forge-devtools/src/plugin/background.ts',
  content: 'forge-devtools/src/plugin/content.ts',
  devtools: 'forge-devtools/src/plugin/devtools.ts',
  panel: 'forge-devtools/src/plugin/panel.tsx',
}

const createPluginConfig = (name, input, plugins) => ({
  input: { [name]: input },
  output: {
    dir: 'dist/plugin',
    format: 'iife',
    entryFileNames: '[name].js',
  },
  resolve: {
    tsconfigFilename: './tsconfig.json',
    alias: { 'react/jsx-runtime': 'preact/jsx-runtime', 'react/jsx-dev-runtime': 'preact/jsx-runtime' },
  },
  jsx: { mode: 'automatic', importSource: 'preact' },
  plugins,
})

// The manifest, html and compiled scss are shared by all four plugin bundles, so
// they attach to the single background build to be emitted exactly once.
const pluginAssetPlugins = [
  copyAssets('forge-devtools/src/plugin', 'dist/plugin', ['.html']),
  {
    name: 'compile-plugin-sass',
    writeBundle() {
      const result = sass.compile('forge-devtools/src/plugin/panel.scss')
      fs.mkdirSync('dist/plugin', { recursive: true })
      fs.writeFileSync('dist/plugin/panel.css', result.css)
    },
  },
  {
    name: 'copy-plugin-manifest',
    writeBundle() {
      fs.copyFileSync('forge-devtools/src/plugin/manifest.json', 'dist/plugin/manifest.json')
    },
  },
]

export default {
  entrypoints: [{ name: 'devtools', input: 'forge-devtools/src/index.ts' }],
  dtsOwnershipRules: [{ match: '/forge-devtools/src/', entrypoint: 'devtools' }],
  extraConfigs: [
    createPluginConfig('background', pluginFiles.background, pluginAssetPlugins),
    createPluginConfig('content', pluginFiles.content, []),
    createPluginConfig('devtools', pluginFiles.devtools, []),
    createPluginConfig('panel', pluginFiles.panel, []),
  ],
}
