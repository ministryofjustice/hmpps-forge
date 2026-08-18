import { ASTNodeType } from '../../../contracts/ast/enums'
import { ASTNode } from '../../../contracts/ast/engine.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import { isASTNode } from '../../../contracts/ast/nodes'
import { NodeIDGenerator } from '../ast-state/NodeIDGenerator'

function isObjectValue(obj: unknown): obj is Record<string, unknown> {
  return obj != null && typeof obj === 'object' && !Array.isArray(obj) && obj.constructor === Object
}

/**
 * Compile an AST value tree into a reusable template.
 *
 * Templates preserve the shape of AST nodes but swap the type to TEMPLATE
 * so they're excluded from traversal, registration, and normalization.
 * The original type is stored in originalType for restoration on instantiation.
 * Template IDs become stable generated runtime instance ID prefixes.
 *
 * Used by the iterate creator to compile iterator payloads once, then
 * instantiate them per collection item at runtime with fresh IDs.
 *
 * AST nodes are converted to template nodes (type swapped to TEMPLATE,
 * original type preserved, id stripped).
 * All other values (primitives, arrays, plain objects) are recursively compiled.
 */
export function compileTemplate(value: unknown, nodeIDGenerator: NodeIDGenerator): TemplateValue {
  if (Array.isArray(value)) {
    return value.map(entry => compileTemplate(entry, nodeIDGenerator))
  }

  if (!isObjectValue(value)) {
    return value as TemplateValue
  }

  if (isASTNode(value)) {
    return compileTemplateNode(value, nodeIDGenerator)
  }

  const compiled: Record<string, TemplateValue> = {}

  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    compiled[key] = compileTemplate(entry, nodeIDGenerator)
  })

  return compiled
}

function compileTemplateNode(node: ASTNode, nodeIDGenerator: NodeIDGenerator): TemplateNode {
  const compiled: TemplateNode = {
    type: ASTNodeType.TEMPLATE,
    originalType: node.type,
    id: nodeIDGenerator.nextTemplateNodeId(),
    diagnostics: node.diagnostics,
  }

  Object.entries(node).forEach(([key, value]) => {
    if (key === 'id' || key === 'type' || key === 'diagnostics') {
      return
    }

    if (key === 'properties' && isObjectValue(value) && !Array.isArray(value)) {
      compiled.properties = {}

      Object.entries(value as Record<string, unknown>).forEach(([propKey, propValue]) => {
        compiled.properties![propKey] = compileTemplate(propValue, nodeIDGenerator)
      })

      return
    }

    compiled[key] = compileTemplate(value, nodeIDGenerator)
  })

  return compiled
}
