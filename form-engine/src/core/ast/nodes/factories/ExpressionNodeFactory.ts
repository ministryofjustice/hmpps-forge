import {
  isReferenceExpr,
  isFormatExpr,
  isPipelineExpr,
  isIterateExpr,
  isMapIteratorConfig,
  isFilterIteratorConfig,
  isFindIteratorConfig,
  isValidationExpr,
  isNextExpr,
  isExpression,
} from '@form-engine/form/typeguards/expressions'
import { isFunctionExpr } from '@form-engine/form/typeguards/functions'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, IteratorType } from '@form-engine/form/types/enums'
import {
  ExpressionASTNode,
  ReferenceASTNode,
  FormatASTNode,
  PipelineASTNode,
  IterateASTNode,
  ValidationASTNode,
  FunctionASTNode,
  NextASTNode,
} from '@form-engine/core/types/expressions.type'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import UnknownNodeTypeError from '@form-engine/errors/UnknownNodeTypeError'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import {
  FormatExpr,
  FunctionExpr,
  IterateExpr,
  NextExpr,
  PipelineExpr,
  ReferenceExpr,
} from '@form-engine/form/types/expressions.type'
import { ValidationExpr } from '@form-engine/form/types/structures.type'
import { NodeFactory } from '../NodeFactory'

/**
 * ExpressionNodeFactory: Creates expression nodes
 * Handles references, pipelines, iterate, validations, and functions
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

    if (isIterateExpr(json)) {
      return this.createIterate(json)
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
      validTypes: ['Reference', 'Format', 'Pipeline', 'Iterate', 'Validation', 'Function', 'Next'],
    })
  }

  /**
   * Transform Reference expression: Points to data in context
   * Examples: Answer('field'), Data('external.value'), Self(), Item()
   *
   * When `base` is present, the reference evaluates the base expression first
   * and then navigates into the result using the path. Empty path is valid
   * when base is present (returns base result directly).
   */
  private createReference(json: ReferenceExpr): ReferenceASTNode {
    // Transform base expression if present
    const base = json.base ? this.nodeFactory.transformValue(json.base) : undefined

    // Build path - allow empty path when base is present
    const path = this.buildReferencePath(json.path, !!base)

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.REFERENCE,
      properties: { path, base },
      raw: json,
    }
  }

  /**
   * Build the reference path, transforming any dynamic expressions.
   * Path splitting is done at the builder level - factory just passes through.
   *
   * @param path - The path segments
   * @param allowEmpty - Whether to allow empty path (valid when base is present)
   */
  private buildReferencePath(path: any[], allowEmpty = false): any[] {
    if (!Array.isArray(path) || (!allowEmpty && path.length === 0)) {
      throw new InvalidNodeError({
        message: 'Reference path must be a non-empty array',
        actual: JSON.stringify(path),
        code: 'INVALID_REFERENCE_PATH',
      })
    }

    // Transform any expressions in the path (e.g., dynamic keys)
    return path.map(segment => (isExpression(segment) ? this.nodeFactory.transformValue(segment) : segment))
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
    // Initial value to transform - use transformValue to support both AST nodes and literals
    const input = this.nodeFactory.transformValue(json.input)

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
   * Transform Iterate expression: Per-item iteration over collections
   *
   * IMPORTANT: Like Collection, the yield/predicate templates are stored as raw JSON,
   * NOT pre-compiled AST nodes. At runtime, they are instantiated once per collection item,
   * creating fresh AST nodes with unique runtime IDs. This allows Item() references to be
   * substituted with actual item data before node creation.
   */
  private createIterate(json: IterateExpr): IterateASTNode {
    const properties: {
      input: ASTNode | any
      iterator: {
        type: IteratorType
        yield?: any
        predicate?: any
      }
    } = {
      // Transform the input data source (this IS an expression that needs evaluation)
      input: this.nodeFactory.transformValue(json.input),
      iterator: {
        type: json.iterator.type,
      },
    }

    // For MAP: store yield template as raw JSON (instantiated at runtime per item)
    if (isMapIteratorConfig(json.iterator)) {
      properties.iterator.yield = json.iterator.yield
    }

    // For FILTER: store predicate as raw JSON (instantiated at runtime per item)
    if (isFilterIteratorConfig(json.iterator)) {
      properties.iterator.predicate = json.iterator.predicate
    }

    // For FIND: store predicate as raw JSON (instantiated at runtime per item)
    if (isFindIteratorConfig(json.iterator)) {
      properties.iterator.predicate = json.iterator.predicate
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.ITERATE,
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
