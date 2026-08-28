import type { MaterialisedASTNode, TemplateASTNode } from '../../../contracts/ast/ast.type'
import { TemplateValue } from '../../../contracts/ast/template.type'
import { isMaterialisedASTNode } from '../../../contracts/ast/nodes'
import { NodeIDGenerator } from '../ast-state/NodeIDGenerator'

function isObjectValue(obj: unknown): obj is Record<string, unknown> {
  return obj != null && typeof obj === 'object' && !Array.isArray(obj) && obj.constructor === Object
}

/**
 * Compile an AST value tree into a reusable template.
 *
 * Templates preserve the semantic kind of AST nodes while marking their
 * unmaterialised state explicitly.
 * Template IDs become stable generated runtime instance ID prefixes.
 *
 * Used by the iterate creator to compile iterator payloads once, then
 * instantiate them per collection item at runtime with fresh IDs.
 *
 * Materialised AST nodes are copied into template AST nodes with fresh IDs.
 * All other values (primitives, arrays, plain objects) are recursively compiled.
 */
export function compileTemplate(value: unknown, nodeIDGenerator: NodeIDGenerator): TemplateValue {
  if (Array.isArray(value)) {
    return value.map(entry => compileTemplate(entry, nodeIDGenerator))
  }

  if (!isObjectValue(value)) {
    return value as TemplateValue
  }

  if (isMaterialisedASTNode(value)) {
    return compileTemplateNode(value, nodeIDGenerator)
  }

  const compiled: Record<string, TemplateValue> = {}

  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    compiled[key] = compileTemplate(entry, nodeIDGenerator)
  })

  return compiled
}

function compileTemplateNode(node: MaterialisedASTNode, nodeIDGenerator: NodeIDGenerator): TemplateASTNode {
  const compiled: Record<string, unknown> = {
    kind: node.kind,
    isTemplate: true,
    id: nodeIDGenerator.nextTemplateNodeId(),
    diagnostics: node.diagnostics,
  }

  Object.entries(node).forEach(([key, value]) => {
    if (key === 'id' || key === 'kind' || key === 'isTemplate' || key === 'diagnostics') {
      return
    }

    if (key === 'properties' && isObjectValue(value) && !Array.isArray(value)) {
      const properties: Record<string, TemplateValue> = {}

      Object.entries(value as Record<string, unknown>).forEach(([propKey, propValue]) => {
        properties[propKey] = compileTemplate(propValue, nodeIDGenerator)
      })

      compiled.properties = properties

      return
    }

    compiled[key] = compileTemplate(value, nodeIDGenerator)
  })

  return compiled as unknown as TemplateASTNode
}
