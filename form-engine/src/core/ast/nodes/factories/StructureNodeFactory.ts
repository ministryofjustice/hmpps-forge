import {
  isJourneyDefinition,
  isStepDefinition,
  isBlockDefinition,
  isFieldBlockDefinition,
} from '@form-engine/form/typeguards/structures'
import { ASTNodeType } from '@form-engine/core/types/enums'
import {
  BlockASTNode,
  BasicBlockASTNode,
  FieldBlockASTNode,
  JourneyASTNode,
  StepASTNode,
} from '@form-engine/core/types/structures.type'
import UnknownNodeTypeError from '@form-engine/errors/UnknownNodeTypeError'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import {
  BlockDefinition,
  FieldBlockDefinition,
  JourneyDefinition,
  StepDefinition,
} from '@form-engine/form/types/structures.type'

/**
 * StructureNodeFactory: Creates structure nodes (Journey, Step, Block)
 * Handles the top-level organizational nodes in the form AST
 */
export class StructureNodeFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
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

    if (isFieldBlockDefinition(json)) {
      return this.createFieldBlock(json)
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
  private createJourney(json: JourneyDefinition): JourneyASTNode {
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

    if (dataProperties.onLoad !== undefined) {
      properties.onLoad = this.nodeFactory.transformValue(dataProperties.onLoad)
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

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.JOURNEY,
      properties,
      raw: json,
    }
  }

  /**
   * Transform Step node: Single page within a journey
   * Contains blocks and transitions for user interaction
   */
  private createStep(json: StepDefinition): StepASTNode {
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

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.STEP,
      properties,
      raw: json,
    }
  }

  /**
   * Transform Block node: UI components that render in steps
   * Determines block category and preserves variant for rendering
   */
  private createBlock(json: BlockDefinition): BlockASTNode {
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
      blockType: 'basic',
      properties,
      raw: json,
    }
  }

  /**
   * Create a field block with typed properties
   */
  private createFieldBlock(json: FieldBlockDefinition): FieldBlockASTNode {
    const { variant, type, ...dataProperties } = json

    // Field blocks MUST have a code property to identify where data is stored
    if (dataProperties.code === undefined) {
      throw new InvalidNodeError({
        message: 'Field block requires a code property',
        node: json,
        expected: 'code property',
        actual: 'undefined',
      })
    }

    const properties: FieldBlockASTNode['properties'] = {}

    properties.code = this.nodeFactory.transformValue(dataProperties.code)

    if (dataProperties.defaultValue !== undefined) {
      properties.defaultValue = this.nodeFactory.transformValue(dataProperties.defaultValue)
    }

    if (dataProperties.formatters !== undefined) {
      properties.formatters = this.nodeFactory.transformValue(dataProperties.formatters)
    }

    if (dataProperties.hidden !== undefined) {
      properties.hidden = this.nodeFactory.transformValue(dataProperties.hidden)
    }

    if (dataProperties.validate !== undefined) {
      properties.validate = this.nodeFactory.transformValue(dataProperties.validate)
    }

    if (dataProperties.dependent !== undefined) {
      properties.dependent = this.nodeFactory.transformValue(dataProperties.dependent)
    }

    if (dataProperties.metadata !== undefined) {
      properties.metadata = dataProperties.metadata
    }

    // Handle sanitize property - stored directly as boolean (defaults to true if not specified)
    if (dataProperties.sanitize !== undefined) {
      properties.sanitize = dataProperties.sanitize
    }

    // This gets injected by the AddSelfValueToFields normalizer, so doesn't appear on the type.
    if ((dataProperties as any).value !== undefined) {
      properties.value = this.nodeFactory.transformValue((dataProperties as any).value)
    }

    // Transform all other properties as component-specific params
    Object.entries(dataProperties).forEach(([key, value]) => {
      if (
        !['code', 'defaultValue', 'formatters', 'hidden', 'validate', 'dependent', 'value', 'sanitize'].includes(key)
      ) {
        properties[key] = this.nodeFactory.transformValue(value)
      }
    })

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.BLOCK,
      variant,
      blockType: 'field',
      properties,
      raw: json,
    }
  }
}
