import { ASTNodeType } from '../../../../contracts/ast/enums'
import { ASTNode } from '../../../../contracts/ast/engine.type'
import { TemplateNode, TemplateValue } from '../../../../contracts/ast/template.type'
import { isASTNode } from '../../../../contracts/ast/nodes'
import { NodeIDGenerator } from '../../ast-state/NodeIDGenerator'
import { isObjectValue } from '../../../../../shared/typeguards/primitives'

/**
 * TemplateFactory: Compiles AST value trees into reusable templates.
 *
 * Templates preserve the shape of AST nodes but swap the type to TEMPLATE
 * so they're excluded from traversal, registration, and normalization.
 * The original type is stored in originalType for restoration on instantiation.
 * Template IDs become stable generated runtime instance ID prefixes.
 *
 * Used by IterateFactory to compile iterator payloads once, then instantiate
 * them per collection item at runtime with fresh IDs.
 */
export default class TemplateFactory {
  constructor(private readonly nodeIDGenerator: NodeIDGenerator) {}

  /**
   * Compile an AST value tree into a reusable template.
   *
   * AST nodes are converted to template nodes (type swapped to TEMPLATE,
   * original type preserved, id stripped).
   * All other values (primitives, arrays, plain objects) are recursively compiled.
   */
  compile(value: unknown): TemplateValue {
    if (Array.isArray(value)) {
      return value.map(entry => this.compile(entry))
    }

    if (!isObjectValue(value)) {
      return value as TemplateValue
    }

    if (isASTNode(value)) {
      return this.compileNode(value)
    }

    const compiled: Record<string, TemplateValue> = {}

    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      compiled[key] = this.compile(entry)
    })

    return compiled
  }

  private compileNode(node: ASTNode): TemplateNode {
    const compiled: TemplateNode = {
      type: ASTNodeType.TEMPLATE,
      originalType: node.type,
      id: this.nodeIDGenerator.nextTemplateNodeId(),
      diagnostics: node.diagnostics,
    }

    Object.entries(node).forEach(([key, value]) => {
      if (key === 'id' || key === 'type' || key === 'diagnostics') {
        return
      }

      if (key === 'properties' && isObjectValue(value) && !Array.isArray(value)) {
        compiled.properties = {}

        Object.entries(value as Record<string, unknown>).forEach(([propKey, propValue]) => {
          compiled.properties![propKey] = this.compile(propValue)
        })

        return
      }

      compiled[key] = this.compile(value)
    })

    return compiled
  }
}
