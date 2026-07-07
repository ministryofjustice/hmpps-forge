import * as path from 'node:path'
import { dts } from 'rolldown-plugin-dts'
import { packageName } from './rolldown.shared.mjs'

const normalizeId = id => id.replaceAll('\\', '/')

// The dts build stays a single combined build across all entrypoints: splitting it
// would change chunk dedup of un-owned files (e.g. forge-core/src/shared/). Each
// package contributes its entrypoints and ownership rules as data; this rewriter
// redirects a cross-entrypoint import to the owning entrypoint's public subpath.
const createDtsEntrypointPlugin = (dtsOwnershipRules, isExternal) => {
  const resolveDtsEntrypoint = id => {
    const normalizedId = normalizeId(id)
    const ownershipRule = dtsOwnershipRules.find(({ match }) => normalizedId.includes(match))

    return ownershipRule ? ownershipRule.entrypoint : undefined
  }

  return {
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
  }
}

export const createDtsConfig = (registry, dtsOwnershipRules, isExternal) => ({
  input: Object.fromEntries(Object.entries(registry).map(([name, input]) => [`${name}/index`, input])),
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: chunk => (chunk.name.endsWith('.d') ? '[name].ts' : '[name].js'),
    chunkFileNames: chunk => (chunk.name.endsWith('.d') ? '[name]-[hash].ts' : '[name]-[hash].js'),
  },
  external: isExternal,
  resolve: { tsconfigFilename: './tsconfig.json' },
  plugins: [createDtsEntrypointPlugin(dtsOwnershipRules, isExternal), dts({ emitDtsOnly: true, tsgo: true })],
})
