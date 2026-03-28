/* eslint-disable import/no-extraneous-dependencies */
import typescript from '@rollup/plugin-typescript'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { dts } from 'rollup-plugin-dts'
/* eslint-enable import/no-extraneous-dependencies */

const subpaths = {
  core: 'packages/form-engine/src/index.ts',
  'core/authoring': 'packages/form-engine/src/authoring/index.ts',
  'core/components': 'packages/form-engine/src/components/index.ts',
  'core/framework': 'packages/form-engine/src/framework/index.ts',
  'core/testing': 'packages/form-engine/src/testing/index.ts',
  'express-nunjucks': 'packages/form-engine-express-nunjucks/src/index.ts',
  'govuk-components': 'packages/form-engine-govuk-components/src/index.ts',
  'moj-components': 'packages/form-engine-moj-components/src/index.ts',
}

const external = [
  'bunyan',
  'express',
  'express-session',
  'hmpps-forge/core',
  'http-errors',
  'nunjucks',
  'zod',
]
const externalPrefixes = [
  'hmpps-forge/core/',
  'hmpps-forge/express-nunjucks',
  'hmpps-forge/govuk-components',
  'hmpps-forge/moj-components',
]

const isExternal = id => {
  if (external.includes(id)) {
    return true
  }

  return externalPrefixes.some(prefix => id === prefix || id.startsWith(prefix))
}

const jsConfigs = Object.entries(subpaths).map(([name, input]) => ({
  input,
  output: [
    { file: `dist/${name}/index.cjs.js`, format: 'cjs', sourcemap: true },
    { file: `dist/${name}/index.esm.js`, format: 'esm', sourcemap: true },
  ],
  plugins: [
    nodeResolve({ preferBuiltins: true }),
    typescript({
      tsconfig: './tsconfig.json',
      noEmitOnError: false,
      declaration: false,
      declarationDir: undefined,
    }),
  ],
  external: isExternal,
}))

const dtsConfigs = Object.entries(subpaths).map(([name, input]) => ({
  input,
  output: {
    file: `dist/${name}/index.d.ts`,
    format: 'esm',
    paths: id => id,
  },
  plugins: [dts({ tsconfig: './tsconfig.json', respectExternal: true })],
  external: isExternal,
}))

export default [...jsConfigs, ...dtsConfigs]
