export default {
  entrypoints: [{ name: 'browser', input: 'forge-browser/src/index.ts' }],
  dtsOwnershipRules: [
    { match: '/forge-browser/src/adapter/', entrypoint: 'browser' },
    { match: '/forge-browser/src/index.ts', entrypoint: 'browser' },
  ],
  extraConfigs: [],
}
