import { ASTNodeType } from '@form-engine/core/types/enums'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { TemplateNode, TemplateValue } from '@form-engine/core/types/template.type'
import { isASTNode, isTemplateNode } from '@form-engine/core/typeguards/nodes'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { ExpressionType } from '@form-engine/form/types/enums'
import { isObjectValue } from '@form-engine/typeguards/primitives'

/**
 * TemplateFactory: Compiles AST value trees into reusable templates.
 *
 * Templates preserve the shape of AST nodes but swap the type to TEMPLATE
 * so they're excluded from traversal, registration, and normalization.
 * The original type is stored in originalType for restoration on instantiation.
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
   * original type preserved, id/raw stripped).
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
      id: this.nodeIDGenerator.next(NodeIDCategory.TEMPLATE),
    }

    Object.entries(node).forEach(([key, value]) => {
      if (key === 'id' || key === 'type' || key === 'raw') {
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

  /**
   * Recreate an AST value tree from a compiled template.
   *
   * Template nodes are turned back into AST nodes (without IDs).
   * Nested iterate templates (yieldTemplate/predicateTemplate) are preserved as
   * template nodes — they get instantiated later when the nested iterate evaluates.
   */
  static instantiate(template: TemplateValue): unknown {
    if (Array.isArray(template)) {
      return template.map(entry => TemplateFactory.instantiate(entry))
    }

    if (!isObjectValue(template)) {
      return template
    }

    if (isTemplateNode(template)) {
      return TemplateFactory.instantiateNode(template)
    }

    const result: Record<string, unknown> = {}

    Object.entries(template as Record<string, TemplateValue>).forEach(([key, entry]) => {
      result[key] = TemplateFactory.instantiate(entry)
    })

    return result
  }

  private static instantiateNode(template: TemplateNode): Record<string, unknown> {
    const node: Record<string, unknown> = { type: template.originalType }
    const isIterate =
      template.originalType === ASTNodeType.EXPRESSION && template.expressionType === ExpressionType.ITERATE

    Object.entries(template).forEach(([key, value]) => {
      if (key === 'type' || key === 'originalType' || key === 'id') {
        return
      }

      if (key === 'properties') {
        node.properties = TemplateFactory.instantiateProperties(template.properties, isIterate)

        return
      }

      node[key] = TemplateFactory.instantiate(value as TemplateValue)
    })

    return node
  }

  private static instantiateProperties(
    properties: Record<string, TemplateValue> | undefined,
    isIterate: boolean,
  ): Record<string, unknown> {
    if (!properties) {
      return {}
    }

    const result: Record<string, unknown> = {}

    Object.entries(properties).forEach(([key, value]) => {
      if (isIterate && key === 'iterator') {
        result[key] = TemplateFactory.instantiateIterator(value)

        return
      }

      result[key] = TemplateFactory.instantiate(value)
    })

    return result
  }

  /**
   * Nested iterate's yieldTemplate/predicateTemplate are preserved as templates —
   * they get instantiated per-item when the nested iterate evaluates.
   */
  private static instantiateIterator(template: TemplateValue): Record<string, unknown> {
    if (!isObjectValue(template) || Array.isArray(template) || isTemplateNode(template)) {
      return {}
    }

    const iterator: Record<string, unknown> = {}

    Object.entries(template as Record<string, TemplateValue>).forEach(([key, value]) => {
      if (key === 'yieldTemplate' || key === 'predicateTemplate') {
        iterator[key] = structuredClone(value)

        return
      }

      iterator[key] = TemplateFactory.instantiate(value)
    })

    return iterator
  }
}
