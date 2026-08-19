import { ASTNodeType } from '../../../contracts/ast/enums'
import {
  ConditionCombinatorType,
  ExpressionType,
  FunctionType,
  IteratorType,
  OutcomeType,
  PredicateType,
} from '../../../../../authoring/types/enums'
import {
  ConditionalASTNode,
  FunctionASTNode,
  IterateASTNode,
  MatchASTNode,
  PipelineASTNode,
  ReferenceASTNode,
  TieBreakerASTNode,
  ValidationASTNode,
} from '../../../contracts/ast/expressions.type'
import type { ASTNode } from '../../../contracts/ast/engine.type'
import type { TemplateValue } from '../../../contracts/ast/template.type'
import {
  ConditionalExpr,
  ConditionAndExpr,
  ConditionCombinatorExpr,
  ConditionBranchExpr,
  ConditionFunctionExpr,
  ConditionNotExpr,
  ConditionOrExpr,
  ConditionXorExpr,
  FunctionExpr,
  IterateExpr,
  MatchExpr,
  PipelineExpr,
  ReferenceExpr,
  ResolvableValue,
} from '../../../../../authoring/types/expressions.type'
import type { TieBreaker, ValidationExpr } from '../../../../../authoring/types/structures.type'
import type { ASTNodeDiagnostics } from '../../../../../shared/diagnostics/sourceLocation.type'
import type {
  AndPredicateASTNode,
  NotPredicateASTNode,
  OrPredicateASTNode,
  PredicateASTNode,
  TestPredicateASTNode,
  XorPredicateASTNode,
} from '../../../contracts/ast/predicates.type'
import ForgeInvalidNodeError from '../../../../errors/ForgeInvalidNodeError'
import type { NodeBuildContext } from './NodeFactory'

/**
 * Every `type` discriminant that marks an authored expression, as opposed to
 * a structure (journey/step/block), a hook, or plain data.
 *
 * ExpressionType.NEXT and IteratorType are deliberately absent: nothing in
 * the authoring surface produces a NEXT expression, and iterator configs are
 * inline configuration consumed by Iterate expressions, not expressions
 * themselves.
 */
const EXPRESSION_TYPES: ReadonlySet<string> = new Set([
  ExpressionType.REFERENCE,
  ExpressionType.PIPELINE,
  ExpressionType.CONDITIONAL,
  ExpressionType.MATCH,
  ExpressionType.ITERATE,
  ExpressionType.VALIDATION,
  ExpressionType.TIE_BREAKER,
  ...Object.values(PredicateType),
  ...Object.values(ConditionCombinatorType),
  ...Object.values(FunctionType),
  ...Object.values(OutcomeType),
])

function isExpression(node: any): boolean {
  return node != null && EXPRESSION_TYPES.has(node.type)
}

const CONDITION_COMBINATOR_TYPES: ReadonlySet<string> = new Set(Object.values(ConditionCombinatorType))

function isConditionNotExpr(obj: any): obj is ConditionNotExpr {
  return obj != null && obj.type === ConditionCombinatorType.NOT
}

function isConditionCombinatorExpr(obj: any): obj is ConditionCombinatorExpr {
  return obj != null && CONDITION_COMBINATOR_TYPES.has(obj.type)
}

/**
 * Reference: Points to data in context
 * Examples: Answer('field'), Data('external.value'), Self(), Item()
 *
 * When `base` is present, the reference evaluates the base expression first
 * and then navigates into the result using the path. Empty path is valid
 * when base is present (returns base result directly).
 */
export function createReferenceNode(json: ReferenceExpr, ctx: NodeBuildContext): ReferenceASTNode {
  // Transform base expression if present
  const base = json.base ? ctx.transformValue<ASTNode>(json.base) : undefined

  // Build path - allow empty path when base is present
  const referencePath = buildReferencePath(json.path, ctx, !!base)

  return {
    id: ctx.nextId(),
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.REFERENCE,
    properties: { path: referencePath, base },
  }
}

/**
 * Build the reference path, transforming any dynamic expressions.
 * Path splitting is done at the builder level - the creator just passes through.
 */
function buildReferencePath(
  path: readonly unknown[],
  ctx: NodeBuildContext,
  allowEmpty = false,
): ReferenceASTNode['properties']['path'] {
  if (!Array.isArray(path) || (!allowEmpty && path.length === 0)) {
    throw new ForgeInvalidNodeError({
      message: 'Reference path must be a non-empty array',
      actual: JSON.stringify(path),
    })
  }

  // Transform any expressions in the path (e.g., dynamic keys)
  return path.map(segment => (isExpression(segment) ? ctx.transformValue(segment) : assertReferenceSegment(segment)))
}

function assertReferenceSegment(segment: unknown): string | number {
  if (typeof segment === 'string' || typeof segment === 'number') {
    return segment
  }

  throw new ForgeInvalidNodeError({
    message: 'Reference path segments must be strings, numbers, or expressions',
    actual: JSON.stringify(segment),
  })
}

/**
 * Pipeline: Sequential data transformations
 * Input flows through each step: input -> step1 -> step2 -> output
 */
export function createPipelineNode(json: PipelineExpr, ctx: NodeBuildContext): PipelineASTNode {
  // Initial value to transform - use transformValue to support both AST nodes and literals
  const input = ctx.transformValue(json.input)

  // Transform each pipeline step
  const steps = json.steps.map((arg: unknown) => ctx.transformValue<ASTNode>(arg))

  return {
    id: ctx.nextId(),
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.PIPELINE,
    properties: {
      input,
      steps,
    },
  }
}

/**
 * Conditional: If-then-else logic, evaluating a predicate to choose between
 * two values. Defaults: thenValue = true, elseValue = false
 */
export function createConditionalNode(json: ConditionalExpr, ctx: NodeBuildContext): ConditionalASTNode {
  if (!json.predicate) {
    const diagnostics = ctx.diagnosticsFor(json)

    throw new ForgeInvalidNodeError({
      message: 'Conditional expression requires a predicate',
      node: json,
      expected: 'predicate property',
      actual: 'undefined',
      formattedPath: diagnostics?.source.formattedPath,
      callsite: diagnostics?.callsite,
    })
  }

  return {
    id: ctx.nextId(),
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.CONDITIONAL,
    properties: {
      predicate: ctx.createNode(json.predicate),
      thenValue: json.thenValue !== undefined ? ctx.transformValue(json.thenValue) : true,
      elseValue: json.elseValue !== undefined ? ctx.transformValue(json.elseValue) : false,
    },
  }
}

/**
 * Iterate: Per-item iteration over collections
 * Iterator payloads are compiled once into reusable templates.
 * At runtime, those templates are instantiated per collection item with fresh IDs.
 */
export function createIterateNode(json: IterateExpr, ctx: NodeBuildContext): IterateASTNode {
  const properties: {
    input: ASTNode | unknown
    iterator: {
      type: IteratorType
      yieldTemplate?: TemplateValue
      predicateTemplate?: TemplateValue
    }
  } = {
    // Transform the input data source (this IS an expression that needs evaluation)
    input: ctx.transformValue(json.input),
    iterator: {
      type: json.iterator.type,
    },
  }

  switch (json.iterator.type) {
    // For MAP: compile yield template once and instantiate per item at runtime
    case IteratorType.MAP:
      properties.iterator.yieldTemplate = compileIteratorTemplate(json.iterator.yield, ctx)
      break
    // For FILTER/FIND: compile predicate template once and instantiate per item at runtime
    case IteratorType.FILTER:
    case IteratorType.FIND:
      properties.iterator.predicateTemplate = compileIteratorTemplate(json.iterator.predicate, ctx)
      break
    default:
      // Unknown iterator types compile without a template, matching the old
      // guard-based behaviour; semantic analysis owns rejecting them.
      break
  }

  return {
    id: ctx.nextId(),
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.ITERATE,
    properties,
  }
}

function compileIteratorTemplate(template: unknown, ctx: NodeBuildContext): TemplateValue {
  return ctx.compileTemplate(ctx.transformValue(template))
}

/**
 * Validation: Field validation rules
 * Contains predicate condition and error message.
 */
export function createValidationNode(json: ValidationExpr, ctx: NodeBuildContext): ValidationASTNode {
  const properties: {
    condition: ASTNode
    message: ASTNode | string
    submissionOnly?: boolean
    groups?: string[]
    details?: Record<string, unknown>
  } = {
    condition: ctx.createNode(json.condition),
    message: ctx.transformValue(json.message || ''),
    submissionOnly: false,
    groups: json.groups ?? ['default'],
  }

  if (json.submissionOnly !== undefined) {
    properties.submissionOnly = json.submissionOnly
  }

  if (json.details) {
    properties.details = ctx.transformValue(json.details)
  }

  return {
    id: ctx.nextId(),
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.VALIDATION,
    properties,
  }
}

/**
 * TieBreaker: Reachability priority rule with an optional condition
 */
export function createTieBreakerNode(json: TieBreaker, ctx: NodeBuildContext): TieBreakerASTNode {
  const properties: TieBreakerASTNode['properties'] = {
    priority: json.priority,
  }

  if (json.when !== undefined) {
    properties.when = ctx.createNode(json.when)
  }

  return {
    id: ctx.nextId(),
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.TIE_BREAKER,
    properties,
  }
}

/**
 * Function: Registered function calls
 * Types: Condition (boolean), Transformer (value), Effect (side-effect), Generator (value)
 */
export function createFunctionNode(json: FunctionExpr<ResolvableValue[]>, ctx: NodeBuildContext): FunctionASTNode {
  const funcType = json.type

  // Transform arguments recursively
  const args = json.arguments.map((arg: unknown) => ctx.transformValue(arg))

  return {
    id: ctx.nextId(),
    type: ASTNodeType.EXPRESSION,
    expressionType: funcType,
    properties: {
      name: json.name,
      arguments: args,
    },
  }
}

/** The shared match subject and root branch condition every synthesised predicate needs. */
interface BranchConditionContext {
  subject: ResolvableValue
  branchCondition: ConditionBranchExpr
}

const LOGICAL_PREDICATE_TYPES = {
  [ConditionCombinatorType.AND]: PredicateType.AND,
  [ConditionCombinatorType.OR]: PredicateType.OR,
  [ConditionCombinatorType.XOR]: PredicateType.XOR,
} as const

/**
 * Match: Evaluates a subject against multiple branches, returning the value
 * of the first branch whose condition matches.
 *
 * A branch condition is either a single condition or a subject-less combinator
 * tree over conditions. The creator expands that tree into the predicate nodes
 * the engine already understands: each condition leaf becomes a TEST predicate
 * pairing the shared match subject with the leaf, and each combinator becomes
 * the matching AND/OR/XOR/NOT predicate over its expanded operands.
 */
export function createMatchNode(json: MatchExpr, ctx: NodeBuildContext): MatchASTNode {
  // Only undefined means missing - 0, '' and false are legal literal subjects
  if (json.subject === undefined) {
    const diagnostics = ctx.diagnosticsFor(json)

    throw new ForgeInvalidNodeError({
      message: 'Match expression requires a subject',
      node: json,
      expected: 'subject property',
      actual: 'undefined',
      formattedPath: diagnostics?.source.formattedPath,
      callsite: diagnostics?.callsite,
    })
  }

  if (!json.branches || json.branches.length === 0) {
    const diagnostics = ctx.diagnosticsFor(json)

    throw new ForgeInvalidNodeError({
      message: 'Match expression requires at least one branch',
      node: json,
      expected: 'non-empty branches array',
      actual: json.branches ? 'empty array' : 'undefined',
      formattedPath: diagnostics?.source.formattedPath,
      callsite: diagnostics?.callsite,
    })
  }

  const compiledBranches = json.branches.map((branch, index) => ({
    predicate: createBranchPredicate(json, index, ctx),
    value: ctx.transformValue(branch.value),
  }))

  return {
    id: ctx.nextId(),
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.MATCH,
    properties: {
      branches: compiledBranches,
      ...(json.otherwise !== undefined && {
        otherwise: ctx.transformValue(json.otherwise),
      }),
    },
  }
}

function createBranchPredicate(json: MatchExpr, branchIndex: number, ctx: NodeBuildContext): PredicateASTNode {
  const branchCondition = json.branches[branchIndex].condition

  return expandCondition(branchCondition, { subject: json.subject, branchCondition }, ctx)
}

function expandCondition(
  condition: ConditionBranchExpr,
  context: BranchConditionContext,
  ctx: NodeBuildContext,
): PredicateASTNode {
  if (isConditionNotExpr(condition)) {
    return createNotPredicate(condition, context, ctx)
  }

  if (isConditionCombinatorExpr(condition)) {
    return createLogicalPredicate(condition, context, ctx)
  }

  return createTestPredicate(condition, context, ctx)
}

function createTestPredicate(
  condition: ConditionFunctionExpr,
  context: BranchConditionContext,
  ctx: NodeBuildContext,
): TestPredicateASTNode {
  return {
    id: ctx.nextId(),
    type: ASTNodeType.PREDICATE,
    predicateType: PredicateType.TEST,
    ...createBranchDiagnostics(context, ctx),
    properties: {
      subject: ctx.transformValue(context.subject),
      condition: ctx.createNode(condition),
      negate: false,
    },
  }
}

function createNotPredicate(
  combinator: ConditionNotExpr,
  context: BranchConditionContext,
  ctx: NodeBuildContext,
): NotPredicateASTNode {
  return {
    id: ctx.nextId(),
    type: ASTNodeType.PREDICATE,
    predicateType: PredicateType.NOT,
    ...createBranchDiagnostics(context, ctx),
    properties: {
      operand: expandCondition(combinator.operand, context, ctx),
    },
  }
}

function createLogicalPredicate(
  combinator: ConditionAndExpr | ConditionOrExpr | ConditionXorExpr,
  context: BranchConditionContext,
  ctx: NodeBuildContext,
): AndPredicateASTNode | OrPredicateASTNode | XorPredicateASTNode {
  return {
    id: ctx.nextId(),
    type: ASTNodeType.PREDICATE,
    predicateType: LOGICAL_PREDICATE_TYPES[combinator.type],
    ...createBranchDiagnostics(context, ctx),
    properties: {
      operands: combinator.operands.map(operand => expandCondition(operand, context, ctx)),
    },
  } as AndPredicateASTNode | OrPredicateASTNode | XorPredicateASTNode
}

function createBranchDiagnostics(
  context: BranchConditionContext,
  ctx: NodeBuildContext,
): { diagnostics: ASTNodeDiagnostics } | undefined {
  const diagnostics = ctx.diagnosticsFor(context.branchCondition)

  return diagnostics && { diagnostics }
}
