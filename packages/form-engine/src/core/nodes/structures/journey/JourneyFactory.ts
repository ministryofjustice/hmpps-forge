import { ASTNodeType } from '@form-engine/core/types/enums'
import { JourneyASTNode } from '@form-engine/core/types/structures.type'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { JourneyDefinition } from '@form-engine/form/types/structures.type'

/**
 * JourneyFactory: Creates Journey AST nodes
 *
 * Journey is the top-level form container that holds steps and configuration.
 */
export default class JourneyFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform Journey node: Top-level form container
   * Extracts properties and recursively transforms nested steps/children
   */
  create(json: JourneyDefinition): JourneyASTNode {
    const { type, ...dataProperties } = json

    const properties: JourneyASTNode['properties'] = {
      code: dataProperties.code,
      path: dataProperties.path,
      title: dataProperties.title,
    }

    if (dataProperties.code === undefined) {
      throw new InvalidNodeError({
        message: 'Journey requires a code property',
        node: json,
        expected: 'code property',
        actual: 'undefined',
      })
    }

    if (dataProperties.path === undefined) {
      throw new InvalidNodeError({
        message: 'Journey requires a path property',
        node: json,
        expected: 'path property',
        actual: 'undefined',
      })
    }

    if (dataProperties.title === undefined) {
      throw new InvalidNodeError({
        message: 'Journey requires a title property',
        node: json,
        expected: 'title property',
        actual: 'undefined',
      })
    }

    if (dataProperties.description !== undefined) {
      properties.description = dataProperties.description
    }

    if (dataProperties.onAccess !== undefined) {
      properties.onAccess = this.nodeFactory.transformValue(dataProperties.onAccess)
    }

    if (dataProperties.steps !== undefined) {
      properties.steps = this.nodeFactory.transformValue(dataProperties.steps)
    }

    if (dataProperties.children !== undefined) {
      properties.children = this.nodeFactory.transformValue(dataProperties.children)
    }

    if (dataProperties.view !== undefined) {
      properties.view = this.nodeFactory.transformValue(dataProperties.view)
    }

    if (dataProperties.entryPath !== undefined) {
      properties.entryPath = dataProperties.entryPath
    }

    if (dataProperties.metadata !== undefined) {
      properties.metadata = dataProperties.metadata
    }

    if (dataProperties.data !== undefined) {
      properties.data = dataProperties.data
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.JOURNEY,
      properties,
      raw: json,
    }
  }
}
