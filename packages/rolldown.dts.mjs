import * as path from 'node:path'
import { dts } from 'rolldown-plugin-dts'
import ts from 'typescript'
import { packageName } from './rolldown.shared.mjs'

const normalizeId = id => id.replaceAll('\\', '/')

// IntelliJ's quick-doc renders @param/@example tags for method signatures but silently
// drops them for function-typed properties (`Foo: (a) => B`). The authoring surface
// (Condition, Transformer, ...) is emitted as `declare const` object types, so every
// member lands as a property and loses its docs on hover. This rewrites those members
// to method syntax (`Foo(a): B`) in the bundled d.ts. Scoped to variable-declaration
// type literals on purpose: method syntax is bivariant, and applying it to callback
// properties in options interfaces would loosen their parameter checking.
const methodizeFunctionProperties = sourceText => {
  const sourceFile = ts.createSourceFile('bundle.d.ts', sourceText, ts.ScriptTarget.Latest, true)
  const edits = []

  const collectPropertyEdits = member => {
    if (!ts.isPropertySignature(member) || member.type === undefined || !ts.isFunctionTypeNode(member.type)) {
      return
    }

    const functionType = member.type
    const arrowToken = functionType.getChildren(sourceFile).find(child => child.kind === ts.SyntaxKind.EqualsGreaterThanToken)

    if (arrowToken === undefined) {
      return
    }

    const nameEnd = (member.questionToken ?? member.name).getEnd()
    edits.push({ start: nameEnd, end: functionType.getStart(sourceFile), text: '' })
    edits.push({ start: arrowToken.getFullStart(), end: arrowToken.getEnd(), text: ':' })
  }

  const visitVariableType = node => {
    if (ts.isTypeLiteralNode(node)) {
      node.members.forEach(collectPropertyEdits)
    }

    node.forEachChild(visitVariableType)
  }

  sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap(statement => statement.declarationList.declarations)
    .filter(declaration => declaration.type !== undefined)
    .forEach(declaration => visitVariableType(declaration.type))

  return edits
    .sort((a, b) => b.start - a.start)
    .reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), sourceText)
}

const createMethodSignaturePlugin = () => ({
  name: 'dts-method-signatures',
  generateBundle(_options, bundle) {
    Object.values(bundle)
      .filter(chunk => chunk.type === 'chunk' && chunk.fileName.endsWith('.d.ts'))
      .forEach(chunk => {
        chunk.code = methodizeFunctionProperties(chunk.code)
      })
  },
})

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
  plugins: [createDtsEntrypointPlugin(dtsOwnershipRules, isExternal), dts({ emitDtsOnly: true, tsgo: {} }), createMethodSignaturePlugin()],
})
