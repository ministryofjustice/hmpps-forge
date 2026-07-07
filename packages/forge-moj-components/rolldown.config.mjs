import { copyAssets } from '../rolldown.shared.mjs'

export default {
  entrypoints: [
    {
      name: 'moj-components',
      input: 'forge-moj-components/src/index.ts',
      // The runtime templates and styles ship next to the compiled JS entrypoint.
      jsPlugins: [copyAssets('forge-moj-components/src', 'dist/moj-components', ['.njk', '.scss'])],
    },
  ],
  dtsOwnershipRules: [],
  extraConfigs: [],
}
