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
import { NodeFactory } from '../NodeFactory'

/**
 * ExpressionNodeFactory: Creates expression nodes
 * Handles references, pipelines, collections, validations, and functions
 */
export class ExpressionNodeFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
  ) {}

  /**
   * Create an expression node based on the JSON type
   */
  create(json: any): ExpressionASTNode {
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
  private createReference(json: any): ReferenceASTNode {
    const properties = new Map<string, ASTNode | any>()

    const transformedPath = Array.isArray(json.path)
      ? json.path.map((segment: any) => this.nodeFactory.transformValue(segment))
      : json.path

    properties.set('path', transformedPath)

    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.REFERENCE,
      properties,
      raw: json,
    }
  }

  /**
   * Transform Format expression: String template with placeholders
   * Replaces placeholders (%1, %2, etc.) with evaluated argument values
   * Example: text: 'address_%1_street', args: [Item().id]
   */
  private createFormat(json: any): FormatASTNode {
    const properties = new Map<string, ASTNode | any>()

    properties.set('text', json.text)

    const transformedArgs = json.args.map((arg: any) => this.nodeFactory.transformValue(arg))

    properties.set('args', transformedArgs)

    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.FORMAT,
      properties,
      raw: json,
    }
  }

  /**
   * Transform Pipeline expression: Sequential data transformations
   * Input flows through each step: input -> step1 -> step2 -> output
   */
  private createPipeline(json: any): PipelineASTNode {
    const properties = new Map<string, ASTNode | any>()

    // Initial value to transform
    properties.set('input', this.nodeFactory.createNode(json.input))

    // Transform each pipeline step
    const steps = json.steps.map((step: any) => {
      const result: any = {
        name: step.name,
      }

      // Optional arguments for transformer functions
      if (step.args) {
        result.args = step.args.map((arg: any) => this.nodeFactory.transformValue(arg))
      }

      return result
    })

    properties.set('steps', steps)

    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.PIPELINE,
      properties,
      raw: json,
    }
  }

  /**
   * Transform Collection expression: Iterate over data to produce repeated templates
   * Note this is just the template, at runtime this template is used to generate
   * actual nodes based on Collection content.
   */
  private createCollection(json: any): CollectionASTNode {
    const properties = new Map<string, ASTNode | any>()

    // Transform the collection data source
    properties.set('collection', this.nodeFactory.transformValue(json.collection))

    // Transform template blocks
    if (json.template) {
      const template = json.template.map((item: any) => this.nodeFactory.createNode(item))
      properties.set('template', template)
    }

    // Transform optional fallback blocks
    if (json.fallback) {
      const fallback = json.fallback.map((item: any) => this.nodeFactory.createNode(item))
      properties.set('fallback', fallback)
    }

    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
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
  private createValidation(json: any): ValidationASTNode {
    const properties = new Map<string, ASTNode | any>()

    if (json.when) {
      properties.set('when', this.nodeFactory.createNode(json.when))
    }

    properties.set('message', json.message || '')

    if (json.submissionOnly !== undefined) {
      properties.set('submissionOnly', json.submissionOnly)
    }

    if (json.details) {
      properties.set('details', json.details)
    }

    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
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
  private createFunction(json: any): FunctionASTNode {
    const funcType = json.type
    const properties = new Map<string, ASTNode | any>()

    properties.set('name', json.name)

    // Transform arguments recursively
    const args = json.arguments.map((arg: any) => this.nodeFactory.transformValue(arg))

    properties.set('arguments', args)

    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
      type: ASTNodeType.EXPRESSION,
      expressionType: funcType,
      properties,
      raw: json,
    }
  }

  /**
   * Transform Next expression: Navigation target
   * Contains optional condition and destination path
   */
  private createNext(json: any): NextASTNode {
    const properties = new Map<string, ASTNode | any>()

    if (json.when) {
      properties.set('when', this.nodeFactory.createNode(json.when))
    }

    properties.set('goto', this.nodeFactory.transformValue(json.goto))

    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.NEXT,
      properties,
      raw: json,
    }
  }
}
