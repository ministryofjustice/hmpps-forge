/* eslint-disable import/no-extraneous-dependencies */
import * as path from 'node:path'
import esbuild from 'rollup-plugin-esbuild'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { dts } from 'rollup-plugin-dts'
/* eslint-enable import/no-extraneous-dependencies */

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

const external = ['express', 'express-session', '@ministryofjustice/hmpps-forge/core', 'http-errors', 'nunjucks', 'zod']
const externalPrefixes = [
  '@ministryofjustice/hmpps-forge/core/',
  '@ministryofjustice/hmpps-forge/express-nunjucks',
  '@ministryofjustice/hmpps-forge/govuk-components',
  '@ministryofjustice/hmpps-forge/moj-components',
]

const isExternal = id => {
  if (external.includes(id)) {
    return true
  }

  return externalPrefixes.some(prefix => id === prefix || id.startsWith(prefix))
}

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

const resolveDtsEntrypoint = id => {
  const normalizedId = normalizeId(id)

  const ownershipRule = dtsOwnershipRules.find(({ match }) => normalizedId.includes(match))

  return ownershipRule?.entrypoint
}

const createDtsEntrypointPlugin = entrypoint => ({
  name: `dts-entrypoint-${entrypoint.replaceAll('/', '-')}`,
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

    const resolvedId = normalizeId(
      path.isAbsolute(source) ? source : path.resolve(path.dirname(importer), source),
    )
    const ownerEntrypoint = resolveDtsEntrypoint(resolvedId)

    if (ownerEntrypoint === undefined || ownerEntrypoint === entrypoint) {
      return null
    }

    return { id: `${packageName}/${ownerEntrypoint}`, external: true }
  },
})

const jsConfigs = Object.entries(subpaths).map(([name, input]) => ({
  input,
  output: [{ file: `dist/${name}/index.mjs`, format: 'esm', sourcemap: true }],
  plugins: [
    nodeResolve({ preferBuiltins: true }),
    esbuild({ tsconfig: './tsconfig.json', target: 'es2024', exclude: 'rollup.config.ts' }),
  ],
  external: isExternal,
}))

const dtsConfigs = Object.entries(subpaths).map(([name, input]) => ({
  input,
  output: {
    file: `dist/${name}/index.d.ts`,
    format: 'esm',
  },
  plugins: [createDtsEntrypointPlugin(name), dts({ tsconfig: './tsconfig.json', respectExternal: true })],
  external: isExternal,
}))

export default [...jsConfigs, ...dtsConfigs]
