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
import { NodeIDGenerator, NodeIDCategory } from '../ast-state/NodeIDGenerator'
import DSLSourceLocator from '../../../diagnostics/DSLSourceLocator'
import type { ASTNodeDiagnostics, DSLPathSegment } from '../../../diagnostics/sourceLocation.type'
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

  private sourceLocator: DSLSourceLocator | undefined

  private currentPath: readonly DSLPathSegment[] = []

  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly category: NodeIDCategory.COMPILE_AST,
    sourceRoot?: unknown,
  ) {
    if (sourceRoot !== undefined) {
      this.sourceLocator = new DSLSourceLocator(sourceRoot)
    }

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
  createNode(json: unknown, path: readonly DSLPathSegment[] = []): ASTNode {
    if (!json || typeof json !== 'object') {
      throw new InvalidNodeError({
        message: `Invalid node: expected object, got ${typeof json}`,
        node: json,
        expected: 'object',
        actual: typeof json,
      })
    }

    const sourceLocator = this.ensureSourceLocator(json)

    return this.withCurrentPath(path, () => {
      // Structure nodes: Journey, Step, Block
      if (isJourneyDefinition(json)) {
        return this.withDiagnostics(this.journeyFactory.create(json), path, sourceLocator)
      }

      if (isStepDefinition(json)) {
        return this.withDiagnostics(this.stepFactory.create(json), path, sourceLocator)
      }

      if (isBlockDefinition(json)) {
        return this.withDiagnostics(this.blockFactory.create(json), path, sourceLocator)
      }

      // Logic nodes: Conditionals and Predicates
      if (isConditionalExpr(json)) {
        return this.withDiagnostics(this.conditionalFactory.create(json), path, sourceLocator)
      }

      if (isMatchExpr(json)) {
        return this.withDiagnostics(this.matchFactory.create(json), path, sourceLocator)
      }

      if (isPredicateTestExpr(json)) {
        return this.withDiagnostics(this.testFactory.create(json), path, sourceLocator)
      }

      if (isPredicateNotExpr(json)) {
        return this.withDiagnostics(this.notFactory.create(json), path, sourceLocator)
      }

      if (isPredicateAndExpr(json)) {
        return this.withDiagnostics(this.andFactory.create(json), path, sourceLocator)
      }

      if (isPredicateOrExpr(json)) {
        return this.withDiagnostics(this.orFactory.create(json), path, sourceLocator)
      }

      if (isPredicateXorExpr(json)) {
        return this.withDiagnostics(this.xorFactory.create(json), path, sourceLocator)
      }

      // Expression nodes: References, Pipelines, Iterate, Validations, TieBreaker, Functions
      if (isReferenceExpr(json)) {
        return this.withDiagnostics(this.referenceFactory.create(json), path, sourceLocator)
      }

      if (isPipelineExpr(json)) {
        return this.withDiagnostics(this.pipelineFactory.create(json), path, sourceLocator)
      }

      if (isIterateExpr(json)) {
        return this.withDiagnostics(this.iterateFactory.create(json), path, sourceLocator)
      }

      if (isValidationExpr(json)) {
        return this.withDiagnostics(this.validationFactory.create(json), path, sourceLocator)
      }

      if (isTieBreaker(json)) {
        return this.withDiagnostics(this.tieBreakerFactory.create(json), path, sourceLocator)
      }

      if (isFunctionExpr(json)) {
        return this.withDiagnostics(this.functionFactory.create(json), path, sourceLocator)
      }

      // Outcome nodes: Redirect, ThrowError
      if (isRedirectOutcome(json)) {
        return this.withDiagnostics(this.redirectOutcomeFactory.create(json), path, sourceLocator)
      }

      if (isThrowErrorOutcome(json)) {
        return this.withDiagnostics(this.throwErrorOutcomeFactory.create(json), path, sourceLocator)
      }

      // Hook nodes: Access, Submit
      if (isAccessHook(json)) {
        return this.withDiagnostics(this.accessFactory.create(json), path, sourceLocator)
      }

      if (isSubmitHook(json)) {
        return this.withDiagnostics(this.submitFactory.create(json), path, sourceLocator)
      }

      throw new UnknownNodeTypeError({
        nodeType: this.getNodeType(json),
        node: json,
        validTypes: ['Journey', 'Step', 'Block', 'Expression', 'Logic', 'Outcome', 'Access', 'Submit'],
      })
    })
  }

  /**
   * Transform value: Recursive processor for any JSON value
   * Detects and transforms nested nodes while preserving primitives
   */
  transformValue<T = unknown>(value: unknown, path: readonly DSLPathSegment[] = []): T {
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
      return value.map((item, index) => {
        // Recursively transform each array item
        return this.transformValue(item, [...path, index])
      }) as T
    }

    // Detect AST nodes and transform them
    if (this.isNode(value)) {
      return this.createNode(value, path) as T
    }

    // Plain objects: Recursively check properties for nested nodes
    // Critical for finding blocks inside component properties
    const result: Record<string, unknown> = {}

    Object.entries(value).forEach(([key, val]) => {
      result[key] = this.transformValue(val, [...path, key])
    })

    return result as T
  }

  createDiagnostics(path: readonly DSLPathSegment[]): ASTNodeDiagnostics {
    return {
      source: this.ensureSourceLocator(undefined).fromPath(path),
    }
  }

  createChildDiagnostics(...segments: DSLPathSegment[]): ASTNodeDiagnostics {
    return this.createDiagnostics(this.getChildPath(segments))
  }

  createChildNode(value: unknown, ...segments: DSLPathSegment[]): ASTNode {
    return this.createNode(value, this.getChildPath(segments))
  }

  transformChild<T = unknown>(value: unknown, ...segments: DSLPathSegment[]): T {
    return this.transformValue<T>(value, this.getChildPath(segments))
  }

  private getChildPath(segments: readonly DSLPathSegment[]): readonly DSLPathSegment[] {
    return [...this.currentPath, ...segments]
  }

  private withCurrentPath<T>(path: readonly DSLPathSegment[], build: () => T): T {
    const previousPath = this.currentPath

    this.currentPath = path

    try {
      return build()
    } finally {
      this.currentPath = previousPath
    }
  }

  private ensureSourceLocator(root: unknown): DSLSourceLocator {
    if (this.sourceLocator === undefined) {
      this.sourceLocator = new DSLSourceLocator(root)
    }

    return this.sourceLocator
  }

  private withDiagnostics<TNode extends ASTNode>(
    node: TNode,
    path: readonly DSLPathSegment[],
    sourceLocator: DSLSourceLocator,
  ): TNode {
    return {
      ...node,
      diagnostics: {
        source: sourceLocator.fromPath(path),
      },
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
