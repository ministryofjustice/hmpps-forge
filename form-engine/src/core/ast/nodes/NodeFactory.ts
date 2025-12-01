import { isJourneyDefinition, isStepDefinition, isBlockDefinition } from '@form-engine/form/typeguards/structures'
import { isExpression, isConditionalExpr } from '@form-engine/form/typeguards/expressions'
import { isPredicateExpr } from '@form-engine/form/typeguards/predicates'
import { isTransition } from '@form-engine/form/typeguards/transitions'
import UnknownNodeTypeError from '@form-engine/errors/UnknownNodeTypeError'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { TransitionNodeFactory } from './factories/TransitionNodeFactory'
import { LogicNodeFactory } from './factories/LogicNodeFactory'
import { ExpressionNodeFactory } from './factories/ExpressionNodeFactory'
import { StructureNodeFactory } from './factories/StructureNodeFactory'

/**
 * NodeFactory: Main entry point for creating AST nodes
 *
 * This factory acts as a dispatcher, routing JSON definitions to specialized
 * factories based on node type:
 *
 * - StructureNodeFactory: Journey, Step, Block
 * - ExpressionNodeFactory: Reference, Pipeline, Collection, Validation, Function
 * - LogicNodeFactory: Conditional, Predicates (Test, And, Or, Xor, Not)
 * - TransitionNodeFactory: Load, Access, Submit
 *
 * This replaces the function-based transformer pattern with a class-based
 * factory pattern for better organization and maintainability.
 */
export class NodeFactory {
  private structureNodeFactory: StructureNodeFactory

  private logicNodeFactory: LogicNodeFactory

  private expressionNodeFactory: ExpressionNodeFactory

  private transitionNodeFactory: TransitionNodeFactory

  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {
    this.structureNodeFactory = new StructureNodeFactory(this.nodeIDGenerator, this, this.category)
    this.logicNodeFactory = new LogicNodeFactory(this.nodeIDGenerator, this, this.category)
    this.expressionNodeFactory = new ExpressionNodeFactory(this.nodeIDGenerator, this, this.category)
    this.transitionNodeFactory = new TransitionNodeFactory(this.nodeIDGenerator, this, this.category)
  }

  /**
   * Main entry point for transformation
   * Sets up error boundary and routes to appropriate factory
   */
  createNode(json: any): ASTNode {
    if (!json || typeof json !== 'object') {
      throw new InvalidNodeError({
        message: `Invalid node: expected object, got ${typeof json}`,
        node: json,
        expected: 'object',
        actual: typeof json,
      })
    }

    // Structure nodes: Journey, Step, Block
    if (isJourneyDefinition(json) || isStepDefinition(json) || isBlockDefinition(json)) {
      return this.structureNodeFactory.create(json)
    }

    // Logic nodes: Predicates and Conditionals
    if (isPredicateExpr(json) || isConditionalExpr(json)) {
      return this.logicNodeFactory.create(json)
    }

    // Expression nodes: References, Pipelines, Collections, Validations, Functions
    if (isExpression(json)) {
      return this.expressionNodeFactory.create(json)
    }

    // Transition nodes: Load, Access, Submit
    if (isTransition(json)) {
      return this.transitionNodeFactory.create(json)
    }

    throw new UnknownNodeTypeError({
      nodeType: json?.type,
      node: json,
      validTypes: ['Journey', 'Step', 'Block', 'Expression', 'Logic', 'Transition'],
    })
  }

  /**
   * Transform value: Recursive processor for any JSON value
   * Detects and transforms nested nodes while preserving primitives
   */
  transformValue(value: any): any {
    // Preserve null/undefined as-is
    if (value === null || value === undefined) {
      return value
    }

    // Primitives (string, number, boolean) pass through
    if (typeof value !== 'object') {
      return value
    }

    // Arrays: Transform each element recursively
    if (Array.isArray(value)) {
      return value.map(item => {
        // Recursively transform each array item
        return this.transformValue(item)
      })
    }

    // Detect AST nodes and transform them
    if (this.isNode(value)) {
      return this.createNode(value)
    }

    // Plain objects: Recursively check properties for nested nodes
    // Critical for finding blocks inside component properties
    const result: any = {}

    Object.entries(value).forEach(([key, val]) => {
      result[key] = this.transformValue(val)
    })

    return result
  }

  /**
   * Node detection: Identifies objects that are AST nodes
   * Nodes have a 'type' field and match known patterns
   */
  private isNode(value: any): boolean {
    // Must be an object
    if (!value || typeof value !== 'object') {
      return false
    }

    // Arrays are not nodes (but may contain nodes)
    if (Array.isArray(value)) {
      return false
    }

    // Nodes must have a string type field
    if (!value.type || typeof value.type !== 'string') {
      return false
    }

    // Check against all known node types
    return isJourneyDefinition(value) ||
      isStepDefinition(value) ||
      isBlockDefinition(value) ||
      isExpression(value) ||
      isTransition(value)
  }
}
