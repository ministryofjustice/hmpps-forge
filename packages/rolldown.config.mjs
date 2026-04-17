import * as fs from 'node:fs'
import * as path from 'node:path'
import { dts } from 'rolldown-plugin-dts'

const subpaths = {
  core: 'forge-core/src/index.ts',
  'core/authoring': 'forge-core/src/authoring/index.ts',
  'core/components': 'forge-core/src/components/index.ts',
  'core/framework': 'forge-core/src/framework/index.ts',
  'express-nunjucks': 'forge-express-nunjucks/src/index.ts',
  'govuk-components': 'forge-govuk-components/src/index.ts',
  'moj-components': 'forge-moj-components/src/index.ts',
}

const packageName = '@ministryofjustice/hmpps-forge'
const entries = Object.entries(subpaths)

const external = ['express', 'express-session', '@ministryofjustice/hmpps-forge/core', 'http-errors', 'nunjucks', 'zod']
const externalPrefixes = [
  '@ministryofjustice/hmpps-forge/core/',
  '@ministryofjustice/hmpps-forge/express-nunjucks',
  '@ministryofjustice/hmpps-forge/govuk-components',
  '@ministryofjustice/hmpps-forge/moj-components',
]

const dtsOwnershipRules = [
  { match: '/forge-core/src/components/', entrypoint: 'core/components' },
  { match: '/forge-core/src/authoring/', entrypoint: 'core/authoring' },
  { match: '/forge-core/src/framework/', entrypoint: 'core/framework' },
  { match: '/forge-core/src/engine/types/ast.type', entrypoint: 'core/framework' },
  { match: '/forge-core/src/engine/types/enums', entrypoint: 'core/framework' },
  { match: '/forge-core/src/engine/types/expressions.type', entrypoint: 'core/framework' },
  { match: '/forge-core/src/engine/types/structures.type', entrypoint: 'core/framework' },
  { match: '/forge-core/src/engine/types/template.type', entrypoint: 'core/framework' },
  { match: '/forge-core/src/engine/nodes/expressions/validation/ValidationHandler', entrypoint: 'core/framework' },
  { match: '/forge-core/src/index.ts', entrypoint: 'core' },
  { match: '/forge-core/src/engine/', entrypoint: 'core' },
]

const normalizeId = id => id.replaceAll('\\', '/')

const isExternal = id => {
  if (external.includes(id)) {
    return true
  }

  return externalPrefixes.some(prefix => id === prefix || id.startsWith(prefix))
}

const resolveDtsEntrypoint = id => {
  const normalizedId = normalizeId(id)
  const ownershipRule = dtsOwnershipRules.find(({ match }) => normalizedId.includes(match))

  return ownershipRule ? ownershipRule.entrypoint : undefined
}

const createDtsEntrypointPlugin = () => ({
  name: 'dts-entrypoint-rewriter',
  resolveId(source, importer) {
    if (isExternal(source)) {
      return { id: source, external: true }
    }

    if (importer === undefined) {
      return null
    }

    if (!source.startsWith('.') && !path.isAbsolute(source)) {
      return null
    }

    const resolvedId = normalizeId(path.isAbsolute(source) ? source : path.resolve(path.dirname(importer), source))
    const importerEntrypoint = resolveDtsEntrypoint(importer)
    const ownerEntrypoint = resolveDtsEntrypoint(resolvedId)

    if (importerEntrypoint === undefined || ownerEntrypoint === undefined || ownerEntrypoint === importerEntrypoint) {
      return null
    }

    return { id: `${packageName}/${ownerEntrypoint}`, external: true }
  },
})

const copyAssets = (sourceDir, destDir, extensions) => ({
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

const createDtsConfig = () => ({
  input: Object.fromEntries(entries.map(([name, input]) => [`${name}/index`, input])),
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: chunk => (chunk.name.endsWith('.d') ? '[name].ts' : '[name].js'),
    chunkFileNames: chunk => (chunk.name.endsWith('.d') ? '[name]-[hash].ts' : '[name]-[hash].js'),
  },
  external: isExternal,
  resolve: { tsconfigFilename: './tsconfig.json' },
  plugins: [
    createDtsEntrypointPlugin(),
    dts({ emitDtsOnly: true, tsgo: true }),
  ],
})

const createJsConfig = ([name, input]) => ({
  input: { index: input },
  output: {
    dir: `dist/${name}`,
    format: 'esm',
    sourcemap: true,
    entryFileNames: '[name].mjs',
    chunkFileNames: '[name]-[hash].mjs',
  },
  external: isExternal,
  resolve: { tsconfigFilename: './tsconfig.json' },
  plugins: [
    ...(name === 'moj-components'
      ? [copyAssets('forge-moj-components/src', 'dist/moj-components', ['.njk', '.scss'])]
      : []),
  ],
})

export default [...entries.map(createJsConfig), createDtsConfig()]
