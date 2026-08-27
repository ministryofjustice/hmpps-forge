import ForgeUnknownNodeTypeError from '../../../../errors/ForgeUnknownNodeTypeError'
import ForgeInvalidNodeError from '../../../../errors/ForgeInvalidNodeError'
import type { AstNodeId, MaterialisedASTNode } from '../../../contracts/ast/engine.type'
import { NodeIDGenerator } from '../ast-state/NodeIDGenerator'
import type { TemplateValue } from '../../../contracts/ast/template.type'
import type { ASTNodeDiagnostics, DSLSourceLocation } from '../../../../../shared/diagnostics/sourceLocation.type'
import { compileTemplate } from './template'
import {
  ComponentCallType,
  ExpressionType,
  FunctionCallType,
  HookType,
  PolicyType,
  PredicateType,
  StructureType,
} from '../../../../../authoring/types/enums'
import { createBasicBlock, createFieldBlock, createJourneyNode, createStepNode } from './structures'
import {
  createConditionalNode,
  createFunctionNode,
  createIterateNode,
  createMatchNode,
  createPipelineNode,
  createReferenceNode,
  createTieBreakerNode,
  createValidationNode,
} from './expressions'
import { createNotPredicateNode, createTestPredicateNode, naryPredicateCreator } from './predicates'
import { createAccessHookNode, createSubmitHookNode } from './hooks'
import { createRedirectOutcomeNode, createThrowErrorOutcomeNode } from './outcomes'

/**
 * The services a node creator borrows from the walker: ID allocation,
 * recursion back into node creation, value transformation, iterator template
 * compilation, and source diagnostics lookup.
 *
 * Passed at call time rather than construction time, so creators are plain
 * functions and there is no circular wiring between the walker and the
 * creators it dispatches to.
 */
export interface NodeBuildContext {
  nextId(): AstNodeId
  createNode(json: unknown): MaterialisedASTNode
  transformValue<T = unknown>(value: unknown): T
  compileTemplate(value: unknown): TemplateValue
  diagnosticsFor(json: unknown): ASTNodeDiagnostics | undefined
}

/**
 * A node creator turns one authored definition into its AST node. Creators
 * are selected from the `creatorsByForgeTag` table below by the `_forge`
 * discriminant, so a creator can assume the input already carries its tag.
 */

export type NodeCreator<TIn = any> = (json: TIn, ctx: NodeBuildContext) => MaterialisedASTNode

const COMBINATOR_PLACEMENT = 'Condition combinators can only appear inside a match expression branch condition'
const ITERATOR_PLACEMENT = 'Iterator configurations can only appear inside the iterator of an Iterate expression'

/**
 * Combinators and iterator configs carry a `_forge` discriminant but are not
 * standalone AST nodes - they're consumed inline by the creator of their parent
 * node. A stray one anywhere else is an authoring mistake, so it throws the
 * placement error - even a coincidental data object - but the valid-types list
 * must not advertise them as constructible.
 */
const isInlineOnly = (tag: string): boolean => tag.startsWith('combinator.') || tag.startsWith('iterator.')

/**
 * The complete registry of every `_forge` discriminant the DSL can emit - one
 * row per enum value. Discriminant values are namespaced strings
 * ('structure.journey', 'predicate.and', ...), so they are globally
 * unique and one flat map covers every node family.
 *
 * This map is the single source for dispatch (`createNode`), node detection
 * (`isNode`), and the valid-types list in `ForgeUnknownNodeTypeError`. Adding
 * a node type means adding a creator and a row here; the completeness test in
 * `NodeFactory.test.ts` fails if an enum value has no row.
 *
 * `PolicyType.NAVIGATION_NEXT` is deliberately absent: nothing in the authoring
 * surface produces it and no factory ever created it.
 */
export const creatorsByForgeTag: ReadonlyMap<string, NodeCreator> = new Map<string, NodeCreator>([
  // Structures
  [StructureType.JOURNEY, createJourneyNode],
  [StructureType.STEP, createStepNode],
  [ComponentCallType.BASIC, createBasicBlock],
  [ComponentCallType.FIELD, createFieldBlock],

  // Expressions
  [ExpressionType.REFERENCE, createReferenceNode],
  [ExpressionType.PIPELINE, createPipelineNode],
  [ExpressionType.CONDITIONAL, createConditionalNode],
  [ExpressionType.MATCH, createMatchNode],
  [ExpressionType.ITERATE, createIterateNode],
  [PolicyType.VALIDATION_RULE, createValidationNode],
  [PolicyType.NAVIGATION_TIE_BREAKER, createTieBreakerNode],

  // Predicates
  [PredicateType.TEST, createTestPredicateNode],
  [PredicateType.NOT, createNotPredicateNode],
  [PredicateType.AND, naryPredicateCreator(PredicateType.AND)],
  [PredicateType.OR, naryPredicateCreator(PredicateType.OR)],
  [PredicateType.XOR, naryPredicateCreator(PredicateType.XOR)],

  // Registered function calls
  [FunctionCallType.CONDITION, createFunctionNode],
  [FunctionCallType.TRANSFORMER, createFunctionNode],
  [FunctionCallType.GENERATOR, createFunctionNode],
  [FunctionCallType.EFFECT, createFunctionNode],

  // Hooks
  [HookType.ACCESS, createAccessHookNode],
  [HookType.SUBMIT, createSubmitHookNode],

  // Hook outcomes
  [PolicyType.OUTCOME_REDIRECT, createRedirectOutcomeNode],
  [PolicyType.OUTCOME_THROW_ERROR, createThrowErrorOutcomeNode],
])

/**
 * NodeFactory: Main entry point for creating AST nodes
 *
 * A walker over authored definitions. Node creation dispatches through the
 * `creatorsByForgeTag` table keyed on the `_forge` discriminant; the creators call
 * back in through `NodeBuildContext` for IDs, recursion, and diagnostics.
 *
 * Source diagnostics are read off the non-enumerable `__source` (and
 * `__callsite`) stamps that finaliseBuilders attaches to every object node of
 * finalised configuration. Unstamped input compiles without diagnostics;
 * downstream consumers fall back to 'unknown'.
 */
export class NodeFactory {
  /** The services creators borrow from the walker. Public so tests can call creators directly. */
  readonly context: NodeBuildContext

  constructor(private readonly nodeIDGenerator: NodeIDGenerator) {
    this.context = {
      nextId: () => this.nodeIDGenerator.nextAstNodeId(),
      createNode: json => this.createNode(json),
      transformValue: <T>(value: unknown): T => this.transformValue(value),
      compileTemplate: value => compileTemplate(value, this.nodeIDGenerator),
      diagnosticsFor: json => this.diagnosticsFor(json),
    }
  }

  /**
   * Main entry point for transformation
   * Looks up the node's creator by its `_forge` discriminant and runs it
   */
  createNode(json: unknown): MaterialisedASTNode {
    if (!json || typeof json !== 'object') {
      throw new ForgeInvalidNodeError({
        message: `Invalid node: expected object, got ${typeof json}`,
        node: json,
        expected: 'object',
        actual: typeof json,
      })
    }

    const forgeTag = this.getForgeTag(json)

    if (forgeTag !== undefined && isInlineOnly(forgeTag)) {
      const diagnostics = this.diagnosticsFor(json)

      throw new ForgeInvalidNodeError({
        message: forgeTag.startsWith('combinator.') ? COMBINATOR_PLACEMENT : ITERATOR_PLACEMENT,
        node: json,
        actual: forgeTag,
        formattedPath: diagnostics?.source.formattedPath,
        callsite: diagnostics?.callsite,
      })
    }

    const create = forgeTag === undefined ? undefined : creatorsByForgeTag.get(forgeTag)

    if (!create) {
      const diagnostics = this.diagnosticsFor(json)

      throw new ForgeUnknownNodeTypeError({
        nodeType: forgeTag,
        node: json,
        validTypes: [...creatorsByForgeTag.keys()],
        formattedPath: diagnostics?.source.formattedPath,
        callsite: diagnostics?.callsite,
      })
    }

    return this.withDiagnostics(create(json, this.context), json)
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

  private withDiagnostics<TNode extends MaterialisedASTNode>(node: TNode, json: unknown): TNode {
    const diagnostics = this.diagnosticsFor(json)

    if (!diagnostics) {
      return node
    }

    return {
      ...node,
      diagnostics,
    } as TNode
  }

  private getForgeTag(value: object): string | undefined {
    if (!('_forge' in value) || typeof value._forge !== 'string') {
      return undefined
    }

    return value._forge
  }

  /**
   * Node detection: Identifies objects that are AST nodes
   * An object is a node when its `_forge` discriminant has a creator - the
   * inline-only tags included, so a stray combinator or iterator config in a
   * data position surfaces its placement error rather than passing as data.
   */
  private isNode(value: object): boolean {
    const forgeTag = this.getForgeTag(value)

    return forgeTag !== undefined && (creatorsByForgeTag.has(forgeTag) || isInlineOnly(forgeTag))
  }
}
