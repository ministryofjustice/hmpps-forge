import { isFieldBlockDefinition } from '@form-engine/form/typeguards/structures'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { BlockType } from '@form-engine/form/types/enums'
import { BasicBlockASTNode, BlockASTNode, FieldBlockASTNode } from '@form-engine/core/types/structures.type'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { BlockDefinition, FieldBlockDefinition } from '@form-engine/form/types/structures.type'

/**
 * BlockFactory: Creates Block AST nodes (both basic and field blocks)
 *
 * Basic blocks are UI components that render but don't collect data.
 * Field blocks are UI components that collect user data via a code property.
 */
export default class BlockFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Create a Block node, delegating to the appropriate type
   */
  create(json: BlockDefinition | FieldBlockDefinition): BlockASTNode {
    if (isFieldBlockDefinition(json)) {
      return this.createFieldBlock(json)
    }

    return this.createBasicBlock(json)
  }

  private createBasicBlock(json: BlockDefinition): BasicBlockASTNode {
    const { variant, type, ...dataProperties } = json
    const properties: BasicBlockASTNode['properties'] = {}

    Object.entries(dataProperties).forEach(([key, value]) => {
      properties[key] = this.nodeFactory.transformValue(value)
    })

    if (dataProperties.metadata !== undefined) {
      properties.metadata = dataProperties.metadata
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.BLOCK,
      variant,
      blockType: BlockType.BASIC,
      properties,
      raw: json,
    }
  }

  private createFieldBlock(json: FieldBlockDefinition): FieldBlockASTNode {
    const { variant, type, ...dataProperties } = json

    if (dataProperties.code === undefined) {
      throw new InvalidNodeError({
        message: 'Field block requires a code property',
        node: json,
        expected: 'code property',
        actual: 'undefined',
      })
    }

    const properties: FieldBlockASTNode['properties'] = {}

    Object.entries(dataProperties).forEach(([key, value]) => {
      properties[key] = this.nodeFactory.transformValue(value)
    })

    // Override properties that should not be transformed
    if (dataProperties.metadata !== undefined) {
      properties.metadata = dataProperties.metadata
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.BLOCK,
      variant,
      blockType: BlockType.FIELD,
      properties,
      raw: json,
    }
  }
}
