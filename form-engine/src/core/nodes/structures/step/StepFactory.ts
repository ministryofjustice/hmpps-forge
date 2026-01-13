import { ASTNodeType } from '@form-engine/core/types/enums'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { StepDefinition } from '@form-engine/form/types/structures.type'

/**
 * StepFactory: Creates Step AST nodes
 *
 * Step represents a single page within a journey, containing blocks and transitions.
 */
export default class StepFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform Step node: Single page within a journey
   * Contains blocks and transitions for user interaction
   */
  create(json: StepDefinition): StepASTNode {
    const { type, ...dataProperties } = json

    const properties: StepASTNode['properties'] = {
      path: json.path,
      title: json.title,
    }

    if (dataProperties.path === undefined) {
      throw new InvalidNodeError({
        message: 'Step requires a path property',
        node: json,
        expected: 'path property',
        actual: 'undefined',
      })
    }

    if (dataProperties.title === undefined) {
      throw new InvalidNodeError({
        message: 'Step requires a title property',
        node: json,
        expected: 'path property',
        actual: 'undefined',
      })
    }

    if (dataProperties.onLoad !== undefined) {
      properties.onLoad = this.nodeFactory.transformValue(dataProperties.onLoad)
    }

    if (dataProperties.onAccess !== undefined) {
      properties.onAccess = this.nodeFactory.transformValue(dataProperties.onAccess)
    }

    if (dataProperties.onAction !== undefined) {
      properties.onAction = this.nodeFactory.transformValue(dataProperties.onAction)
    }

    if (dataProperties.onSubmission !== undefined) {
      properties.onSubmission = this.nodeFactory.transformValue(dataProperties.onSubmission)
    }

    if (dataProperties.blocks !== undefined) {
      properties.blocks = this.nodeFactory.transformValue(dataProperties.blocks)
    }

    if (dataProperties.view !== undefined) {
      properties.view = this.nodeFactory.transformValue(dataProperties.view)
    }

    if (dataProperties.isEntryPoint !== undefined) {
      properties.isEntryPoint = dataProperties.isEntryPoint
    }

    if (dataProperties.backlink !== undefined) {
      properties.backlink = dataProperties.backlink
    }

    if (dataProperties.metadata !== undefined) {
      properties.metadata = dataProperties.metadata
    }

    if (dataProperties.data !== undefined) {
      properties.data = dataProperties.data
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.STEP,
      properties,
      raw: json,
    }
  }
}
