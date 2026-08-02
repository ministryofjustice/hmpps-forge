import { isJourneyDefinition, isStepDefinition, isBlockDefinition } from '../../../../authoring/typeguards/structures'
import {
  isExpression,
  isConditionalExpr,
  isMatchExpr,
  isReferenceExpr,
  isPipelineExpr,
  isIterateExpr,
  isTieBreaker,
  isValidationExpr,
  isRedirectOutcome,
  isThrowErrorOutcome,
  isHookOutcome,
} from '../../../../authoring/typeguards/expressions'
import { isFunctionExpr } from '../../../../authoring/typeguards/functions'
import {
  isPredicateTestExpr,
  isPredicateNotExpr,
  isPredicateAndExpr,
  isPredicateOrExpr,
  isPredicateXorExpr,
} from '../../../../authoring/typeguards/predicates'
import { isAccessHook, isSubmitHook } from '../../../../authoring/typeguards/hooks'
import UnknownNodeTypeError from '../../../errors/UnknownNodeTypeError'
import InvalidNodeError from '../../../errors/InvalidNodeError'
import type { ASTNode } from '../../../contracts/ast/engine.type'
import { NodeIDGenerator } from '../ast-state/NodeIDGenerator'
import type { ASTNodeDiagnostics, DSLSourceLocation } from '../../../../shared/diagnostics/sourceLocation.type'
import JourneyFactory from './structures/journey/JourneyFactory'
import StepFactory from './structures/step/StepFactory'
import BlockFactory from './structures/block/BlockFactory'
import AccessFactory from './hooks/access/AccessFactory'
import SubmitFactory from './hooks/submit/SubmitFactory'
import ConditionalFactory from './expressions/conditional/ConditionalFactory'
import MatchFactory from './expressions/match/MatchFactory'
import TestFactory from './predicates/test/TestFactory'
import NotFactory from './predicates/not/NotFactory'
import AndFactory from './predicates/and/AndFactory'
import OrFactory from './predicates/or/OrFactory'
import XorFactory from './predicates/xor/XorFactory'
import ReferenceFactory from './expressions/reference/ReferenceFactory'
import PipelineFactory from './expressions/pipeline/PipelineFactory'
import IterateFactory from './expressions/iterate/IterateFactory'
import ValidationFactory from './expressions/validation/ValidationFactory'
import TieBreakerFactory from './expressions/tie-breaker/TieBreakerFactory'
import FunctionFactory from './expressions/function/FunctionFactory'
import RedirectOutcomeFactory from './outcomes/redirect/RedirectOutcomeFactory'
import ThrowErrorOutcomeFactory from './outcomes/throw-error/ThrowErrorOutcomeFactory'

/**
 * NodeFactory: Main entry point for creating AST nodes
 *
 * This factory acts as a dispatcher, routing JSON definitions to specialized
 * per-node factories based on node type.
 *
 * Source diagnostics are read off the non-enumerable `__source` (and
 * `__callsite`) stamps that finaliseBuilders attaches to every object node of
 * finalised configuration. Unstamped input compiles without diagnostics;
 * downstream consumers fall back to 'unknown'.
 */
export class NodeFactory {
  private readonly journeyFactory: JourneyFactory

  private readonly stepFactory: StepFactory

  private readonly blockFactory: BlockFactory

  private readonly accessFactory: AccessFactory

  private readonly submitFactory: SubmitFactory

  private readonly conditionalFactory: ConditionalFactory

  private readonly matchFactory: MatchFactory

  private readonly testFactory: TestFactory

  private readonly notFactory: NotFactory

  private readonly andFactory: AndFactory

  private readonly orFactory: OrFactory

  private readonly xorFactory: XorFactory

  private readonly referenceFactory: ReferenceFactory

  private readonly pipelineFactory: PipelineFactory

  private readonly iterateFactory: IterateFactory

  private readonly validationFactory: ValidationFactory

  private readonly tieBreakerFactory: TieBreakerFactory

  private readonly functionFactory: FunctionFactory

  private readonly redirectOutcomeFactory: RedirectOutcomeFactory

  private readonly throwErrorOutcomeFactory: ThrowErrorOutcomeFactory

  constructor(private readonly nodeIDGenerator: NodeIDGenerator) {
    this.journeyFactory = new JourneyFactory(this.nodeIDGenerator, this)
    this.stepFactory = new StepFactory(this.nodeIDGenerator, this)
    this.blockFactory = new BlockFactory(this.nodeIDGenerator, this)
    this.accessFactory = new AccessFactory(this.nodeIDGenerator, this)
    this.submitFactory = new SubmitFactory(this.nodeIDGenerator, this)
    this.conditionalFactory = new ConditionalFactory(this.nodeIDGenerator, this)
    this.matchFactory = new MatchFactory(this.nodeIDGenerator, this)
    this.testFactory = new TestFactory(this.nodeIDGenerator, this)
    this.notFactory = new NotFactory(this.nodeIDGenerator, this)
    this.andFactory = new AndFactory(this.nodeIDGenerator, this)
    this.orFactory = new OrFactory(this.nodeIDGenerator, this)
    this.xorFactory = new XorFactory(this.nodeIDGenerator, this)
    this.referenceFactory = new ReferenceFactory(this.nodeIDGenerator, this)
    this.pipelineFactory = new PipelineFactory(this.nodeIDGenerator, this)
    this.iterateFactory = new IterateFactory(this.nodeIDGenerator, this)
    this.validationFactory = new ValidationFactory(this.nodeIDGenerator, this)
    this.tieBreakerFactory = new TieBreakerFactory(this.nodeIDGenerator, this)
    this.functionFactory = new FunctionFactory(this.nodeIDGenerator, this)
    this.redirectOutcomeFactory = new RedirectOutcomeFactory(this.nodeIDGenerator, this)
    this.throwErrorOutcomeFactory = new ThrowErrorOutcomeFactory(this.nodeIDGenerator, this)
  }

  /**
   * Main entry point for transformation
   * Sets up error boundary and routes to appropriate factory
   */
  createNode(json: unknown): ASTNode {
    if (!json || typeof json !== 'object') {
      throw new InvalidNodeError({
        message: `Invalid node: expected object, got ${typeof json}`,
        node: json,
        expected: 'object',
        actual: typeof json,
      })
    }

    // Structure nodes: Journey, Step, Block
    if (isJourneyDefinition(json)) {
      return this.withDiagnostics(this.journeyFactory.create(json), json)
    }

    if (isStepDefinition(json)) {
      return this.withDiagnostics(this.stepFactory.create(json), json)
    }

    if (isBlockDefinition(json)) {
      return this.withDiagnostics(this.blockFactory.create(json), json)
    }

    // Logic nodes: Conditionals and Predicates
    if (isConditionalExpr(json)) {
      return this.withDiagnostics(this.conditionalFactory.create(json), json)
    }

    if (isMatchExpr(json)) {
      return this.withDiagnostics(this.matchFactory.create(json), json)
    }

    if (isPredicateTestExpr(json)) {
      return this.withDiagnostics(this.testFactory.create(json), json)
    }

    if (isPredicateNotExpr(json)) {
      return this.withDiagnostics(this.notFactory.create(json), json)
    }

    if (isPredicateAndExpr(json)) {
      return this.withDiagnostics(this.andFactory.create(json), json)
    }

    if (isPredicateOrExpr(json)) {
      return this.withDiagnostics(this.orFactory.create(json), json)
    }

    if (isPredicateXorExpr(json)) {
      return this.withDiagnostics(this.xorFactory.create(json), json)
    }

    // Expression nodes: References, Pipelines, Iterate, Validations, TieBreaker, Functions
    if (isReferenceExpr(json)) {
      return this.withDiagnostics(this.referenceFactory.create(json), json)
    }

    if (isPipelineExpr(json)) {
      return this.withDiagnostics(this.pipelineFactory.create(json), json)
    }

    if (isIterateExpr(json)) {
      return this.withDiagnostics(this.iterateFactory.create(json), json)
    }

    if (isValidationExpr(json)) {
      return this.withDiagnostics(this.validationFactory.create(json), json)
    }

    if (isTieBreaker(json)) {
      return this.withDiagnostics(this.tieBreakerFactory.create(json), json)
    }

    if (isFunctionExpr(json)) {
      return this.withDiagnostics(this.functionFactory.create(json), json)
    }

    // Outcome nodes: Redirect, ThrowError
    if (isRedirectOutcome(json)) {
      return this.withDiagnostics(this.redirectOutcomeFactory.create(json), json)
    }

    if (isThrowErrorOutcome(json)) {
      return this.withDiagnostics(this.throwErrorOutcomeFactory.create(json), json)
    }

    // Hook nodes: Access, Submit
    if (isAccessHook(json)) {
      return this.withDiagnostics(this.accessFactory.create(json), json)
    }

    if (isSubmitHook(json)) {
      return this.withDiagnostics(this.submitFactory.create(json), json)
    }

    throw new UnknownNodeTypeError({
      nodeType: this.getNodeType(json),
      node: json,
      validTypes: ['Journey', 'Step', 'Block', 'Expression', 'Logic', 'Outcome', 'Access', 'Submit'],
    })
  }

  /**
   * Transform value: Recursive processor for any JSON value
   * Detects and transforms nested nodes while preserving primitives
   */
  transformValue<T = unknown>(value: unknown): T {
    // Preserve null/undefined as-is
    if (value === null || value === undefined) {
      return value as T
    }

    // Primitives (string, number, boolean) pass through
    if (typeof value !== 'object') {
      return value as T
    }

    // Arrays: Transform each element recursively
    if (Array.isArray(value)) {
      return value.map(item => this.transformValue(item)) as T
    }

    // Detect AST nodes and transform them
    if (this.isNode(value)) {
      return this.createNode(value) as T
    }

    // Plain objects: Recursively check properties for nested nodes
    // Critical for finding blocks inside component properties
    const result: Record<string, unknown> = {}

    Object.entries(value).forEach(([key, val]) => {
      result[key] = this.transformValue(val)
    })

    return result as T
  }

  /**
   * Derive AST node diagnostics from the source stamps on a JSON node.
   * Returns undefined for unstamped input.
   */
  diagnosticsFor(json: unknown): ASTNodeDiagnostics | undefined {
    if (json === null || typeof json !== 'object') {
      return undefined
    }

    const source = Object.getOwnPropertyDescriptor(json, '__source')?.value as DSLSourceLocation | undefined

    if (!source) {
      return undefined
    }

    const callsite = Object.getOwnPropertyDescriptor(json, '__callsite')?.value as { stack?: string } | undefined

    return {
      source,
      ...(callsite && { callsite }),
    }
  }

  private withDiagnostics<TNode extends ASTNode>(node: TNode, json: unknown): TNode {
    const diagnostics = this.diagnosticsFor(json)

    if (!diagnostics) {
      return node
    }

    return {
      ...node,
      diagnostics,
    } as TNode
  }

  private getNodeType(value: object): string | undefined {
    if (!('type' in value) || typeof value.type !== 'string') {
      return undefined
    }

    return value.type
  }

  /**
   * Node detection: Identifies objects that are AST nodes
   * Nodes have a 'type' field and match known patterns
   */
  private isNode(value: unknown): boolean {
    // Must be an object
    if (!value || typeof value !== 'object') {
      return false
    }

    // Arrays are not nodes (but may contain nodes)
    if (Array.isArray(value)) {
      return false
    }

    // Nodes must have a string type field
    if (!('type' in value) || typeof value.type !== 'string') {
      return false
    }

    // Check against all known node types
    return isJourneyDefinition(value) ||
      isStepDefinition(value) ||
      isBlockDefinition(value) ||
      isExpression(value) ||
      isHookOutcome(value) ||
      isAccessHook(value) ||
      isSubmitHook(value)
  }
}
