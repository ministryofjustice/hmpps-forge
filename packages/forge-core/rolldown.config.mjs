export default {
  entrypoints: [
    { name: 'core', input: 'forge-core/src/index.ts' },
    { name: 'core/authoring', input: 'forge-core/src/authoring/index.ts' },
    { name: 'core/components', input: 'forge-core/src/components/index.ts' },
    { name: 'core/framework', input: 'forge-core/src/framework/index.ts' },
    { name: 'core/testing', input: 'forge-core/src/testing/index.ts' },
  ],
  // Order matters: the specific ast.type / enums rules must win over the broader
  // /forge-core/src/engine/ rule below them, which is matched by find().
  dtsOwnershipRules: [
    { match: '/forge-core/src/built-ins/components', entrypoint: 'core/components' },
    { match: '/forge-core/src/built-ins/', entrypoint: 'core/authoring' },
    { match: '/forge-core/src/components/', entrypoint: 'core/components' },
    { match: '/forge-core/src/authoring/', entrypoint: 'core/authoring' },
    { match: '/forge-core/src/framework/', entrypoint: 'core/framework' },
    { match: '/forge-core/src/engine/chassis/contracts/ast/ast.type', entrypoint: 'core/framework' },
    { match: '/forge-core/src/engine/chassis/contracts/ast/enums', entrypoint: 'core/framework' },
    { match: '/forge-core/src/engine/chassis/contracts/ast/expressions.type', entrypoint: 'core/framework' },
    { match: '/forge-core/src/engine/chassis/contracts/ast/structures.type', entrypoint: 'core/framework' },
    { match: '/forge-core/src/engine/chassis/contracts/ast/template.type', entrypoint: 'core/framework' },
    { match: '/forge-core/src/testing/', entrypoint: 'core/testing' },
    { match: '/forge-core/src/instrumentation/', entrypoint: 'core' },
    { match: '/forge-core/src/index.ts', entrypoint: 'core' },
    { match: '/forge-core/src/engine/', entrypoint: 'core' },
  ],
  extraConfigs: [],
}
