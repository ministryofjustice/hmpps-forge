import * as fs from 'node:fs'
import * as path from 'node:path'
import { dts } from 'rolldown-plugin-dts'

const subpaths = {
  core: 'forge-core/src/index.ts',
  'core/authoring': 'forge-core/src/authoring/index.ts',
  'core/components': 'forge-core/src/components/index.ts',
  'core/framework': 'forge-core/src/framework/index.ts',
  'core/testing': 'forge-core/src/testing/index.ts',
  'express-nunjucks': 'forge-express-nunjucks/src/index.ts',
  'govuk-components': 'forge-govuk-components/src/index.ts',
  'moj-components': 'forge-moj-components/src/index.ts',
  'next-react': 'forge-next-react/src/index.ts',
  'next-react/client': 'forge-next-react/src/client.tsx',
}

const packageName = '@ministryofjustice/hmpps-forge'
const entries = Object.entries(subpaths)
const jsFormats = [
  { extension: 'mjs', format: 'esm' },
  { extension: 'cjs', format: 'cjs' },
]

const external = [
  'express',
  'express-session',
  '@ministryofjustice/hmpps-forge/core',
  'http-errors',
  'next',
  'nunjucks',
  'react',
  'react-dom',
  'zod',
]
const externalPrefixes = [
  '@ministryofjustice/hmpps-forge/core/',
  '@ministryofjustice/hmpps-forge/express-nunjucks',
  '@ministryofjustice/hmpps-forge/govuk-components',
  '@ministryofjustice/hmpps-forge/moj-components',
  '@ministryofjustice/hmpps-forge/next-react',
  'next/',
  'react/',
  'react-dom/',
]

const dtsOwnershipRules = [
  { match: '/forge-core/src/components/', entrypoint: 'core/components' },
  { match: '/forge-core/src/authoring/', entrypoint: 'core/authoring' },
  { match: '/forge-core/src/framework/', entrypoint: 'core/framework' },
  { match: '/forge-core/src/engine/contracts/ast/ast.type', entrypoint: 'core/framework' },
  { match: '/forge-core/src/engine/contracts/ast/enums', entrypoint: 'core/framework' },
  { match: '/forge-core/src/engine/contracts/ast/expressions.type', entrypoint: 'core/framework' },
  { match: '/forge-core/src/engine/contracts/ast/structures.type', entrypoint: 'core/framework' },
  { match: '/forge-core/src/engine/contracts/ast/template.type', entrypoint: 'core/framework' },
  { match: '/forge-core/src/testing/', entrypoint: 'core/testing' },
  { match: '/forge-core/src/instrumentation/', entrypoint: 'core' },
  { match: '/forge-core/src/index.ts', entrypoint: 'core' },
  { match: '/forge-core/src/engine/', entrypoint: 'core' },
  { match: '/forge-next-react/src/client', entrypoint: 'next-react/client' },
  { match: '/forge-next-react/src/', entrypoint: 'next-react' },
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

const createJsConfig = ([name, input], { extension, format }) => ({
  input: { index: input },
  output: {
    dir: `dist/${name}`,
    format,
    sourcemap: true,
    entryFileNames: `[name].${extension}`,
    chunkFileNames: `[name]-[hash].${extension}`,
  },
  external: isExternal,
  resolve: { tsconfigFilename: './tsconfig.json' },
  plugins: [
    ...(name === 'moj-components'
      ? [copyAssets('forge-moj-components/src', 'dist/moj-components', ['.njk', '.scss'])]
      : []),
  ],
})

export default [...entries.flatMap(entry => jsFormats.map(format => createJsConfig(entry, format))), createDtsConfig()]
