import * as fs from 'node:fs'
import * as path from 'node:path'

export const packageName = '@ministryofjustice/hmpps-forge'

export const jsFormats = [
  { extension: 'mjs', format: 'esm' },
  { extension: 'cjs', format: 'cjs' },
]

const nonPackageExternals = ['express', 'express-session', 'http-errors', 'nunjucks', 'ws', 'zod']

export const createIsExternal = registry => {
  const entrypointIds = Object.keys(registry).map(name => `${packageName}/${name}`)

  return id => {
    if (id.startsWith('node:')) {
      return true
    }

    if (nonPackageExternals.includes(id)) {
      return true
    }

    return entrypointIds.some(entrypointId => id === entrypointId || id.startsWith(`${entrypointId}/`))
  }
}

export const copyAssets = (sourceDir, destDir, extensions) => ({
  name: 'copy-assets',
  writeBundle() {
    const copyRecursive = (src, dest) => {
      if (!fs.existsSync(src)) {
        return
      }

      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)

        if (entry.isDirectory()) {
          copyRecursive(srcPath, destPath)
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true })
          fs.copyFileSync(srcPath, destPath)
        }
      }
    }

    copyRecursive(sourceDir, destDir)
  },
})

export const createJsConfig = (name, input, { extension, format }, isExternal, plugins = []) => ({
  input: { index: input },
  output: {
    dir: `dist/${name}`,
    format,
    sourcemap: true,
    codeSplitting: false,
    entryFileNames: `[name].${extension}`,
  },
  external: isExternal,
  resolve: { tsconfigFilename: './tsconfig.json' },
  plugins,
})
