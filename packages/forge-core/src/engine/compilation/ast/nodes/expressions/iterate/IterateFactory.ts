import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { ExpressionType, IteratorType } from '../../../../../../authoring/types/enums'
import { IterateASTNode } from '../../../../../contracts/ast/expressions.type'
import type { ASTNode } from '../../../../../contracts/ast/engine.type'
import { IterateExpr } from '../../../../../../authoring/types/expressions.type'
import {
  isMapIteratorConfig,
  isFilterIteratorConfig,
  isFindIteratorConfig,
} from '../../../../../../authoring/typeguards/expressions'
import { NodeIDGenerator, NodeIDCategory } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'
import { TemplateValue } from '../../../../../contracts/ast/template.type'
import TemplateFactory from '../../template/TemplateFactory'
import type { DSLPathSegment } from '../../../../../diagnostics/sourceLocation.type'

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
    private readonly category: NodeIDCategory.COMPILE_AST,
  ) {
    this.templateFactory = new TemplateFactory(nodeIDGenerator)
  }

  /**
   * Transform Iterate expression: Per-item iteration over collections
   */
  create(json: IterateExpr): IterateASTNode {
    const properties: {
      input: ASTNode | unknown
      iterator: {
        type: IteratorType
        yieldTemplate?: TemplateValue
        predicateTemplate?: TemplateValue
      }
    } = {
      // Transform the input data source (this IS an expression that needs evaluation)
      input: this.nodeFactory.transformChild(json.input, 'input'),
      iterator: {
        type: json.iterator.type,
      },
    }

    // For MAP: compile yield template once and instantiate per item at runtime
    if (isMapIteratorConfig(json.iterator)) {
      properties.iterator.yieldTemplate = this.compileIteratorTemplate(json.iterator.yield, 'iterator', 'yield')
    }

    // For FILTER: compile predicate template once and instantiate per item at runtime
    if (isFilterIteratorConfig(json.iterator)) {
      properties.iterator.predicateTemplate = this.compileIteratorTemplate(
        json.iterator.predicate,
        'iterator',
        'predicate',
      )
    }

    // For FIND: compile predicate template once and instantiate per item at runtime
    if (isFindIteratorConfig(json.iterator)) {
      properties.iterator.predicateTemplate = this.compileIteratorTemplate(
        json.iterator.predicate,
        'iterator',
        'predicate',
      )
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.ITERATE,
      properties,
    }
  }

  private compileIteratorTemplate(template: unknown, ...segments: DSLPathSegment[]): TemplateValue {
    const transformedTemplate = this.nodeFactory.transformChild(template, ...segments)

    return this.templateFactory.compile(transformedTemplate)
  }
}
