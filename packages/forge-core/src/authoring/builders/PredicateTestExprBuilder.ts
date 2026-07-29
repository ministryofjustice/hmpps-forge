import {
  ConditionFunctionExpr,
  ConditionBranchExpr,
  ConditionAndExpr,
  ConditionOrExpr,
  ConditionXorExpr,
  ConditionNotExpr,
  PredicateExpr,
  PredicateAndExpr,
  PredicateOrExpr,
  PredicateXorExpr,
  PredicateNotExpr,
  PredicateTestExpr,
  ResolvableValue,
} from '../types/expressions.type'
import { ConditionCombinatorType, FunctionType, PredicateType } from '../types/enums'

/**
 * Fluent builder for creating predicate test expressions.
 * Allows chaining of negation and condition matching against a subject value.
 */
export class PredicateTestExprBuilder {
  private readonly subject: ResolvableValue

  private negateNext = false

  constructor(subject: ResolvableValue) {
    this.subject = subject
  }

  /**
   * Negates the next condition test.
   * Can be chained: `value(ref).not.match(condition)`
   */
  get not(): this {
    this.negateNext = !this.negateNext
    return this
  }

  private buildTest(condition: ConditionFunctionExpr<any>): PredicateTestExpr {
    const test: PredicateTestExpr = {
      type: PredicateType.TEST,
      subject: this.subject,
      negate: this.negateNext,
      condition,
    }
    this.negateNext = false
    return test
  }

  /**
   * Creates a test predicate that checks if the subject matches the given condition.
   * @param condition - The condition function to test against
   * @returns A predicate test expression
   */
  match(condition: ConditionFunctionExpr<any>): PredicateTestExpr {
    return this.buildTest(condition)
  }
}

/**
 * Converts a predicate input to a resolved predicate expression.
 * Ensures PredicateBuilder instances have called .match() before use.
 */
function resolvePredicate(p: PredicateExpr | PredicateTestExprBuilder | PredicateTestExpr): PredicateExpr {
  if (p instanceof PredicateTestExprBuilder) {
    throw new Error('PredicateBuilder must call .match() before use')
  }
  return p
}

/** A single operand of a combinator: a bare condition branch, or a predicate. */
type CombinatorOperand = ConditionBranchExpr | PredicateExpr

/** Both call forms the AND, OR and XOR combinators accept: one array, or two or more operands. */
type CombinatorArgs = [CombinatorOperand[]] | [CombinatorOperand, CombinatorOperand, ...CombinatorOperand[]]

/** The kind of operand a combinator was called with, which decides the node it builds. */
enum OperandKind {
  CONDITION = 'OperandKind.Condition',
  PREDICATE = 'OperandKind.Predicate',
}

type ClassifiedOperands =
  | { kind: OperandKind.CONDITION; operands: ConditionBranchExpr[] }
  | { kind: OperandKind.PREDICATE; operands: PredicateExpr[] }

const conditionCombinatorTypes = new Set<string>(Object.values(ConditionCombinatorType))

/**
 * Identifies a bare condition branch - a condition function call, or a nested
 * condition combinator over them - as opposed to a predicate, which carries its own subject.
 */
function isConditionBranch(operand: CombinatorOperand): operand is ConditionBranchExpr {
  return operand.type === FunctionType.CONDITION || conditionCombinatorTypes.has(operand.type)
}

/**
 * Flattens the array and variadic call forms into a single operand list, and
 * classifies that list as bare conditions or as predicates.
 * @param fnName - The combinator's name, used in the mixed operand error
 * @param args - The arguments the combinator was called with, in either form
 * @returns The flattened operands, tagged with the kind they all share
 * @throws When conditions and predicates are mixed in one call, which the overloads
 * already rule out for TypeScript callers
 */
function classifyOperands(fnName: string, args: CombinatorArgs): ClassifiedOperands {
  const operands = Array.isArray(args[0]) && args.length === 1 ? args[0] : (args as CombinatorOperand[])
  const conditions = operands.filter(isConditionBranch)
  const predicates = operands.filter((operand): operand is PredicateExpr => !isConditionBranch(operand))

  if (conditions.length === 0) {
    return { kind: OperandKind.PREDICATE, operands: predicates.map(resolvePredicate) }
  }

  if (predicates.length > 0) {
    throw new Error(
      `${fnName}() cannot mix bare conditions with predicates — conditions take their subject from the surrounding match`,
    )
  }

  return { kind: OperandKind.CONDITION, operands: conditions }
}

/**
 * Creates an AND combination where all operands must be true.
 * Given predicates, returns an AND logic predicate.
 * Given bare conditions, or combinators over them, returns a subject-less AND
 * condition combinator, whose conditions take their subject from the surrounding match.
 * @param p - Two or more operands to combine, as one array or as separate arguments
 * @returns A logic predicate, or a condition combinator, that is true if all operands are true
 */
export function and(p: PredicateExpr[]): PredicateAndExpr
export function and(...p: [PredicateExpr, PredicateExpr, ...PredicateExpr[]]): PredicateAndExpr
export function and(c: ConditionBranchExpr[]): ConditionAndExpr
export function and(...c: [ConditionBranchExpr, ConditionBranchExpr, ...ConditionBranchExpr[]]): ConditionAndExpr
export function and(...args: CombinatorArgs): PredicateAndExpr | ConditionAndExpr {
  const classified = classifyOperands('and', args)

  if (classified.kind === OperandKind.CONDITION) {
    return {
      type: ConditionCombinatorType.AND,
      operands: classified.operands as [ConditionBranchExpr, ConditionBranchExpr, ...ConditionBranchExpr[]],
    }
  }

  return {
    type: PredicateType.AND,
    operands: classified.operands as [PredicateExpr, PredicateExpr, ...PredicateExpr[]],
  }
}

/**
 * Creates an OR combination where at least one operand must be true.
 * Given predicates, returns an OR logic predicate.
 * Given bare conditions, or combinators over them, returns a subject-less OR
 * condition combinator, whose conditions take their subject from the surrounding match.
 * @param p - Two or more operands to combine, as one array or as separate arguments
 * @returns A logic predicate, or a condition combinator, that is true if any operand is true
 */
export function or(p: PredicateExpr[]): PredicateOrExpr
export function or(...p: [PredicateExpr, PredicateExpr, ...PredicateExpr[]]): PredicateOrExpr
export function or(c: ConditionBranchExpr[]): ConditionOrExpr
export function or(...c: [ConditionBranchExpr, ConditionBranchExpr, ...ConditionBranchExpr[]]): ConditionOrExpr
export function or(...args: CombinatorArgs): PredicateOrExpr | ConditionOrExpr {
  const classified = classifyOperands('or', args)

  if (classified.kind === OperandKind.CONDITION) {
    return {
      type: ConditionCombinatorType.OR,
      operands: classified.operands as [ConditionBranchExpr, ConditionBranchExpr, ...ConditionBranchExpr[]],
    }
  }

  return {
    type: PredicateType.OR,
    operands: classified.operands as [PredicateExpr, PredicateExpr, ...PredicateExpr[]],
  }
}

/**
 * Creates an XOR combination where exactly one operand must be true.
 * Given predicates, returns an XOR logic predicate.
 * Given bare conditions, or combinators over them, returns a subject-less XOR
 * condition combinator, whose conditions take their subject from the surrounding match.
 * @param p - Two or more operands to combine, as one array or as separate arguments
 * @returns A logic predicate, or a condition combinator, that is true if exactly one operand is true
 */
export function xor(p: PredicateExpr[]): PredicateXorExpr
export function xor(...p: [PredicateExpr, PredicateExpr, ...PredicateExpr[]]): PredicateXorExpr
export function xor(c: ConditionBranchExpr[]): ConditionXorExpr
export function xor(...c: [ConditionBranchExpr, ConditionBranchExpr, ...ConditionBranchExpr[]]): ConditionXorExpr
export function xor(...args: CombinatorArgs): PredicateXorExpr | ConditionXorExpr {
  const classified = classifyOperands('xor', args)

  if (classified.kind === OperandKind.CONDITION) {
    return {
      type: ConditionCombinatorType.XOR,
      operands: classified.operands as [ConditionBranchExpr, ConditionBranchExpr, ...ConditionBranchExpr[]],
    }
  }

  return {
    type: PredicateType.XOR,
    operands: classified.operands as [PredicateExpr, PredicateExpr, ...PredicateExpr[]],
  }
}

/**
 * Creates a NOT combination that inverts the operand's result.
 * Given a predicate, returns a NOT logic predicate.
 * Given a bare condition, or a combinator over them, returns a subject-less NOT
 * condition combinator, whose conditions take their subject from the surrounding match.
 * @param p - The operand to negate
 * @returns A logic predicate, or a condition combinator, that is the opposite of the operand
 */
export function not(p: PredicateExpr): PredicateNotExpr
export function not(c: ConditionBranchExpr): ConditionNotExpr
export function not(operand: CombinatorOperand): PredicateNotExpr | ConditionNotExpr {
  if (isConditionBranch(operand)) {
    return {
      type: ConditionCombinatorType.NOT,
      operand,
    }
  }

  return {
    type: PredicateType.NOT,
    operand: resolvePredicate(operand),
  }
}
