export default {
  entrypoints: [
    { name: 'jsx-components', input: 'forge-jsx-components/src/index.ts' },
    // Separate entrypoint because the automatic JSX transform resolves
    // `<jsxImportSource>/jsx-runtime` as a module in its own right. The package's
    // `jsx-dev-runtime` subpath (used by dev transforms) points at this same build -
    // the module exports `jsxDEV` alongside `jsx`/`jsxs`.
    { name: 'jsx-components/jsx-runtime', input: 'forge-jsx-components/src/runtime/jsx-runtime.ts' },
  ],
  dtsOwnershipRules: [
    { match: '/forge-jsx-components/src/runtime/', entrypoint: 'jsx-components/jsx-runtime' },
    { match: '/forge-jsx-components/', entrypoint: 'jsx-components' },
  ],
  extraConfigs: [],
}
