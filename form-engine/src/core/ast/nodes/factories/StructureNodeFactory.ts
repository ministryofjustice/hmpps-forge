import {
  isJourneyDefinition,
  isStepDefinition,
  isBlockDefinition,
  isFieldBlockDefinition,
} from '@form-engine/form/typeguards/structures'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { BlockASTNode, JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import UnknownNodeTypeError from '@form-engine/errors/UnknownNodeTypeError'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'

/**
 * StructureNodeFactory: Creates structure nodes (Journey, Step, Block)
 * Handles the top-level organizational nodes in the form AST
 */
export class StructureNodeFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
  ) {}

  /**
   * Create a structure node based on the JSON type
   */
  create(json: any): JourneyASTNode | StepASTNode | BlockASTNode {
    if (isJourneyDefinition(json)) {
      return this.createJourney(json)
    }

    if (isStepDefinition(json)) {
      return this.createStep(json)
    }

    if (isBlockDefinition(json)) {
      return this.createBlock(json)
    }

    throw new UnknownNodeTypeError({
      nodeType: json?.type,
      node: json,
      validTypes: ['JourneyDefinition', 'StepDefinition', 'BlockDefinition'],
    })
  }

  /**
   * Transform Journey node: Top-level form container
   * Extracts properties and recursively transforms nested steps/children
   */
  private createJourney(json: any): JourneyASTNode {
    const { type, ...dataProperties } = json
    const properties = this.nodeFactory.transformProperties(dataProperties)

    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
      type: ASTNodeType.JOURNEY,
      properties,
      raw: json,
    }
  }

  /**
   * Transform Step node: Single page within a journey
   * Contains blocks and transitions for user interaction
   */
  private createStep(json: any): StepASTNode {
    const { type, ...dataProperties } = json
    const properties = this.nodeFactory.transformProperties(dataProperties)

    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
      type: ASTNodeType.STEP,
      properties,
      raw: json,
    }
  }

  /**
   * Transform Block node: UI components that render in steps
   * Determines block category and preserves variant for rendering
   */
  private createBlock(json: any): BlockASTNode {
    const { variant, type, ...dataProperties } = json
    const properties = this.nodeFactory.transformProperties(dataProperties)

    const blockType = this.determineBlockType(json)

    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
      type: ASTNodeType.BLOCK,
      variant,
      blockType,
      properties,
      raw: json,
    }
  }

  /**
   * Classify block for AST traversal optimization
   */
  private determineBlockType(json: any): 'basic' | 'field' {
    if (isFieldBlockDefinition(json)) {
      return 'field'
    }

    return 'basic'
  }
}
