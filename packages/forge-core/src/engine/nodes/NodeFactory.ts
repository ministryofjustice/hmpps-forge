import { isJourneyDefinition, isStepDefinition, isBlockDefinition } from '../../authoring/typeguards/structures'
import {
  isExpression,
  isConditionalExpr,
  isMatchExpr,
  isReferenceExpr,
  isFormatExpr,
  isPipelineExpr,
  isIterateExpr,
  isTieBreaker,
  isValidationExpr,
  isRedirectOutcome,
  isThrowErrorOutcome,
  isHookOutcome,
} from '../../authoring/typeguards/expressions'
import { isFunctionExpr } from '../../authoring/typeguards/functions'
import {
  isPredicateTestExpr,
  isPredicateNotExpr,
  isPredicateAndExpr,
  isPredicateOrExpr,
  isPredicateXorExpr,
} from '../../authoring/typeguards/predicates'
import { isAccessHook, isSubmitHook } from '../../authoring/typeguards/hooks'
import UnknownNodeTypeError from '../errors/UnknownNodeTypeError'
import InvalidNodeError from '../errors/InvalidNodeError'
import { ASTNode } from '../types/engine.type'
import { NodeIDGenerator, NodeIDCategory } from '../compilation/id-generators/NodeIDGenerator'
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
import FormatFactory from './expressions/format/FormatFactory'
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

  private readonly formatFactory: FormatFactory

  private readonly pipelineFactory: PipelineFactory

  private readonly iterateFactory: IterateFactory

  private readonly validationFactory: ValidationFactory

  private readonly tieBreakerFactory: TieBreakerFactory

  private readonly functionFactory: FunctionFactory

  private readonly redirectOutcomeFactory: RedirectOutcomeFactory

  private readonly throwErrorOutcomeFactory: ThrowErrorOutcomeFactory

  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly category: NodeIDCategory.COMPILE_AST,
  ) {
    this.journeyFactory = new JourneyFactory(this.nodeIDGenerator, this, this.category)
    this.stepFactory = new StepFactory(this.nodeIDGenerator, this, this.category)
    this.blockFactory = new BlockFactory(this.nodeIDGenerator, this, this.category)
    this.accessFactory = new AccessFactory(this.nodeIDGenerator, this, this.category)
    this.submitFactory = new SubmitFactory(this.nodeIDGenerator, this, this.category)
    this.conditionalFactory = new ConditionalFactory(this.nodeIDGenerator, this, this.category)
    this.matchFactory = new MatchFactory(this.nodeIDGenerator, this, this.category)
    this.testFactory = new TestFactory(this.nodeIDGenerator, this, this.category)
    this.notFactory = new NotFactory(this.nodeIDGenerator, this, this.category)
    this.andFactory = new AndFactory(this.nodeIDGenerator, this, this.category)
    this.orFactory = new OrFactory(this.nodeIDGenerator, this, this.category)
    this.xorFactory = new XorFactory(this.nodeIDGenerator, this, this.category)
    this.referenceFactory = new ReferenceFactory(this.nodeIDGenerator, this, this.category)
    this.formatFactory = new FormatFactory(this.nodeIDGenerator, this, this.category)
    this.pipelineFactory = new PipelineFactory(this.nodeIDGenerator, this, this.category)
    this.iterateFactory = new IterateFactory(this.nodeIDGenerator, this, this.category)
    this.validationFactory = new ValidationFactory(this.nodeIDGenerator, this, this.category)
    this.tieBreakerFactory = new TieBreakerFactory(this.nodeIDGenerator, this, this.category)
    this.functionFactory = new FunctionFactory(this.nodeIDGenerator, this, this.category)
    this.redirectOutcomeFactory = new RedirectOutcomeFactory(this.nodeIDGenerator, this, this.category)
    this.throwErrorOutcomeFactory = new ThrowErrorOutcomeFactory(this.nodeIDGenerator, this, this.category)
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
    if (isJourneyDefinition(json)) {
      return this.journeyFactory.create(json)
    }

    if (isStepDefinition(json)) {
      return this.stepFactory.create(json)
    }

    if (isBlockDefinition(json)) {
      return this.blockFactory.create(json)
    }

    // Logic nodes: Conditionals and Predicates
    if (isConditionalExpr(json)) {
      return this.conditionalFactory.create(json)
    }

    if (isMatchExpr(json)) {
      return this.matchFactory.create(json)
    }

    if (isPredicateTestExpr(json)) {
      return this.testFactory.create(json)
    }

    if (isPredicateNotExpr(json)) {
      return this.notFactory.create(json)
    }

    if (isPredicateAndExpr(json)) {
      return this.andFactory.create(json)
    }

    if (isPredicateOrExpr(json)) {
      return this.orFactory.create(json)
    }

    if (isPredicateXorExpr(json)) {
      return this.xorFactory.create(json)
    }

    // Expression nodes: References, Format, Pipelines, Iterate, Validations, Functions, Next
    if (isReferenceExpr(json)) {
      return this.referenceFactory.create(json)
    }

    if (isFormatExpr(json)) {
      return this.formatFactory.create(json)
    }

    if (isPipelineExpr(json)) {
      return this.pipelineFactory.create(json)
    }

    if (isIterateExpr(json)) {
      return this.iterateFactory.create(json)
    }

    if (isValidationExpr(json)) {
      return this.validationFactory.create(json)
    }

    if (isTieBreaker(json)) {
      return this.tieBreakerFactory.create(json)
    }

    if (isFunctionExpr(json)) {
      return this.functionFactory.create(json)
    }

    // Outcome nodes: Redirect, ThrowError
    if (isRedirectOutcome(json)) {
      return this.redirectOutcomeFactory.create(json)
    }

    if (isThrowErrorOutcome(json)) {
      return this.throwErrorOutcomeFactory.create(json)
    }

    // Hook nodes: Access, Submit
    if (isAccessHook(json)) {
      return this.accessFactory.create(json)
    }

    if (isSubmitHook(json)) {
      return this.submitFactory.create(json)
    }

    throw new UnknownNodeTypeError({
      nodeType: json?.type,
      node: json,
      validTypes: ['Journey', 'Step', 'Block', 'Expression', 'Logic', 'Outcome', 'Access', 'Submit'],
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
      isHookOutcome(value) ||
      isAccessHook(value) ||
      isSubmitHook(value)
  }
}
