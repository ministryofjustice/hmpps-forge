export default {
  entrypoints: [
    { name: 'browser', input: 'forge-browser/src/index.ts' },
    { name: 'browser/nunjucks-loader', input: 'forge-browser/src/renderer/BrowserPrecompiledLoader.ts' },
  ],
  dtsOwnershipRules: [
    { match: '/forge-browser/src/renderer/BrowserPrecompiledLoader', entrypoint: 'browser/nunjucks-loader' },
    { match: '/forge-browser/src/adapter/', entrypoint: 'browser' },
    { match: '/forge-browser/src/renderer/', entrypoint: 'browser' },
    { match: '/forge-browser/src/index.ts', entrypoint: 'browser' },
  ],
  extraConfigs: [],
}
