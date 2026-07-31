export default {
  entrypoints: [
    { name: 'jsx-components', input: 'forge-jsx-components/src/index.ts' },
    // Separate entrypoints because the automatic JSX transform resolves
    // `<jsxImportSource>/jsx-runtime` (and `/jsx-dev-runtime` in dev transforms)
    // as modules in their own right.
    { name: 'jsx-components/jsx-runtime', input: 'forge-jsx-components/src/runtime/jsx-runtime.ts' },
    { name: 'jsx-components/jsx-dev-runtime', input: 'forge-jsx-components/src/runtime/jsx-dev-runtime.ts' },
  ],
  // Order matters: the dev-runtime rule must win over the broader runtime rule below
  // it, so the dev entrypoint imports the runtime via its public subpath instead of
  // sharing a chunk with it.
  dtsOwnershipRules: [
    { match: '/forge-jsx-components/src/runtime/jsx-dev-runtime', entrypoint: 'jsx-components/jsx-dev-runtime' },
    { match: '/forge-jsx-components/src/runtime/', entrypoint: 'jsx-components/jsx-runtime' },
    { match: '/forge-jsx-components/', entrypoint: 'jsx-components' },
  ],
  extraConfigs: [],
}
