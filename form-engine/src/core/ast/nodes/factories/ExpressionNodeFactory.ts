import {
  isReferenceExpr,
  isFormatExpr,
  isPipelineExpr,
  isCollectionExpr,
  isValidationExpr,
  isNextExpr,
} from '@form-engine/form/typeguards/expressions'
import { isFunctionExpr } from '@form-engine/form/typeguards/functions'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType } from '@form-engine/form/types/enums'
import {
  ExpressionASTNode,
  ReferenceASTNode,
  FormatASTNode,
  PipelineASTNode,
  CollectionASTNode,
  ValidationASTNode,
  FunctionASTNode,
  NextASTNode,
} from '@form-engine/core/types/expressions.type'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import UnknownNodeTypeError from '@form-engine/errors/UnknownNodeTypeError'
import {
  CollectionExpr,
  FormatExpr,
  FunctionExpr,
  NextExpr,
  PipelineExpr,
  ReferenceExpr,
} from '@form-engine/form/types/expressions.type'
import { ValidationExpr } from '@form-engine/form/types/structures.type'
import { NodeFactory } from '../NodeFactory'

/**
 * ExpressionNodeFactory: Creates expression nodes
 * Handles references, pipelines, collections, validations, and functions
 */
export class ExpressionNodeFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Create an expression node based on the JSON type
   */
  create(json: any): ExpressionASTNode | FunctionASTNode {
    if (isReferenceExpr(json)) {
      return this.createReference(json)
    }

    if (isFormatExpr(json)) {
      return this.createFormat(json)
    }

    if (isPipelineExpr(json)) {
      return this.createPipeline(json)
    }

    if (isCollectionExpr(json)) {
      return this.createCollection(json)
    }

    if (isValidationExpr(json)) {
      return this.createValidation(json)
    }

    if (isFunctionExpr(json)) {
      return this.createFunction(json)
    }

    if (isNextExpr(json)) {
      return this.createNext(json)
    }

    throw new UnknownNodeTypeError({
      nodeType: json?.type,
      node: json,
      validTypes: ['Reference', 'Format', 'Pipeline', 'Collection', 'Validation', 'Function', 'Next'],
    })
  }

  /**
   * Transform Reference expression: Points to data in context
   * Examples: Answer('field'), Data('external.value'), Self(), Item()
   */
  private createReference(json: ReferenceExpr): ReferenceASTNode {
    const transformedPath = Array.isArray(json.path)
      ? json.path.map((segment: any) => this.nodeFactory.transformValue(segment))
      : json.path

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.REFERENCE,
      properties: {
        path: transformedPath,
      },
      raw: json,
    }
  }

  /**
   * Transform Format expression: String template with placeholders
   * Replaces placeholders (%1, %2, etc.) with evaluated argument values
   * Example: template: 'address_%1_street', arguments: [Item().id]
   */
  private createFormat(json: FormatExpr): FormatASTNode {
    const transformedArgs = json.arguments.map((arg: any) => this.nodeFactory.transformValue(arg))

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.FORMAT,
      properties: {
        template: json.template,
        arguments: transformedArgs,
      },
      raw: json,
    }
  }

  /**
   * Transform Pipeline expression: Sequential data transformations
   * Input flows through each step: input -> step1 -> step2 -> output
   */
  private createPipeline(json: PipelineExpr): PipelineASTNode {
    // Initial value to transform
    const input = this.nodeFactory.createNode(json.input)

    // Transform each pipeline step
    const steps = json.steps.map((arg: any) => this.nodeFactory.transformValue(arg))

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.PIPELINE,
      properties: {
        input,
        steps,
      },
      raw: json,
    }
  }

  /**
   * Transform Collection expression: Iterate over data to produce repeated templates
   *
   * IMPORTANT: The template is stored as raw JSON, NOT pre-compiled AST nodes.
   * At runtime, the template is instantiated once per collection item, creating fresh
   * AST nodes with unique runtime IDs. This allows Item() references to be substituted
   * with actual item data before node creation.
   *
   */
  private createCollection(json: CollectionExpr): CollectionASTNode {
    const properties: {
      collection: ASTNode | any
      template: any
      fallback?: ASTNode[]
    } = {
      // Transform the collection data source (this IS an expression that needs evaluation)
      collection: this.nodeFactory.transformValue(json.collection),
      // Store template as raw JSON - will be instantiated at runtime per collection item
      template: json.template,
    }

    // Transform fallback blocks normally - they're shown when collection is empty
    if (json.fallback) {
      properties.fallback = json.fallback.map((item: any) => this.nodeFactory.createNode(item))
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.COLLECTION,
      properties,
      raw: json,
    }
  }

  /**
   * Transform Validation expression: Field validation rules
   * Contains predicate condition and error message
   */
  private createValidation(json: ValidationExpr): ValidationASTNode {
    const properties: {
      when: ASTNode
      message: ASTNode | string
      submissionOnly?: boolean
      details?: Record<string, any>
    } = {
      when: this.nodeFactory.createNode(json.when),
      message: this.nodeFactory.transformValue(json.message || ''),
      submissionOnly: false, // Default to false
    }

    if (json.submissionOnly !== undefined) {
      properties.submissionOnly = json.submissionOnly
    }

    if (json.details) {
      properties.details = json.details
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.VALIDATION,
      properties,
      raw: json,
    }
  }

  /**
   * Transform Function expression: Registered function calls
   * Types: Condition (boolean), Transformer (value), Effect (side-effect)
   */
  private createFunction(json: FunctionExpr<any>): FunctionASTNode {
    const funcType = json.type

    // Transform arguments recursively
    const args = json.arguments.map((arg: any) => this.nodeFactory.transformValue(arg))

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: funcType,
      properties: {
        name: json.name,
        arguments: args,
      },
      raw: json,
    }
  }

  /**
   * Transform Next expression: Navigation target
   * Contains optional condition and destination path
   */
  private createNext(json: NextExpr): NextASTNode {
    const properties: { when?: ASTNode; goto: ASTNode | any } = {
      goto: this.nodeFactory.transformValue(json.goto),
    }

    if (json.when) {
      properties.when = this.nodeFactory.createNode(json.when)
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.NEXT,
      properties,
      raw: json,
    }
  }
}
