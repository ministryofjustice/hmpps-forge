import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, IteratorType } from '@form-engine/form/types/enums'
import { IterateASTNode } from '@form-engine/core/types/expressions.type'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { IterateExpr } from '@form-engine/form/types/expressions.type'
import {
  isMapIteratorConfig,
  isFilterIteratorConfig,
  isFindIteratorConfig,
} from '@form-engine/form/typeguards/expressions'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { TemplateValue } from '@form-engine/core/types/template.type'
import TemplateFactory from '@form-engine/core/nodes/template/TemplateFactory'

/**
 * IterateFactory: Creates Iterate expression AST nodes
 *
 * Iterate expressions implement per-item iteration over collections.
 * Iterator payloads are compiled once into reusable templates.
 * At runtime, those templates are instantiated per collection item with fresh IDs.
 */
export default class IterateFactory {
  private readonly templateFactory: TemplateFactory

  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {
    this.templateFactory = new TemplateFactory(nodeIDGenerator)
  }

  /**
   * Transform Iterate expression: Per-item iteration over collections
   */
  create(json: IterateExpr): IterateASTNode {
    const properties: {
      input: ASTNode | any
      iterator: {
        type: IteratorType
        yieldTemplate?: TemplateValue
        predicateTemplate?: TemplateValue
      }
    } = {
      // Transform the input data source (this IS an expression that needs evaluation)
      input: this.nodeFactory.transformValue(json.input),
      iterator: {
        type: json.iterator.type,
      },
    }

    // For MAP: compile yield template once and instantiate per item at runtime
    if (isMapIteratorConfig(json.iterator)) {
      properties.iterator.yieldTemplate = this.compileIteratorTemplate(json.iterator.yield)
    }

    // For FILTER: compile predicate template once and instantiate per item at runtime
    if (isFilterIteratorConfig(json.iterator)) {
      properties.iterator.predicateTemplate = this.compileIteratorTemplate(json.iterator.predicate)
    }

    // For FIND: compile predicate template once and instantiate per item at runtime
    if (isFindIteratorConfig(json.iterator)) {
      properties.iterator.predicateTemplate = this.compileIteratorTemplate(json.iterator.predicate)
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.ITERATE,
      properties,
      raw: json,
    }
  }

  private compileIteratorTemplate(template: unknown): TemplateValue {
    const transformedTemplate = this.nodeFactory.transformValue(template)

    return this.templateFactory.compile(transformedTemplate)
  }
}
