/**
 * Discriminates the four kinds of registered function a call expression can
 * target: conditions test values, transformers reshape them, generators
 * produce them, and effects perform side effects in hooks.
 */
export enum FunctionType {
  CONDITION = 'FunctionType.Condition',
  TRANSFORMER = 'FunctionType.Transformer',
  GENERATOR = 'FunctionType.Generator',
  EFFECT = 'FunctionType.Effect',
}

/**
 * Discriminates the structural nodes a form is built from: journeys contain
 * steps, steps contain blocks.
 */
export enum StructureType {
  BLOCK = 'StructureType.Block',
  JOURNEY = 'StructureType.Journey',
  STEP = 'StructureType.Step',
}

/**
 * Distinguishes field blocks, which collect answers, from basic blocks,
 * which only display content.
 */
export enum BlockType {
  FIELD = 'BlockType.field',
  BASIC = 'BlockType.basic',
}

/**
 * Discriminates expression nodes: value expressions such as references,
 * pipelines, conditionals, and iterations, plus rule nodes such as
 * validations and tie-breakers.
 */
export enum ExpressionType {
  REFERENCE = 'ExpressionType.Reference',
  PIPELINE = 'ExpressionType.Pipeline',
  NEXT = 'ExpressionType.Next',
  VALIDATION = 'ExpressionType.Validation',
  ITERATE = 'ExpressionType.Iterate',
  CONDITIONAL = 'ExpressionType.Conditional',
  MATCH = 'ExpressionType.Match',
  TIE_BREAKER = 'ExpressionType.TieBreaker',
}

/**
 * Discriminates the per-item operations an iterate expression can apply to
 * a collection.
 */
export enum IteratorType {
  MAP = 'IteratorType.Map',
  FILTER = 'IteratorType.Filter',
  FIND = 'IteratorType.Find',
}

/**
 * Discriminates predicate nodes: a single condition test, or a logical
 * combination of other predicates.
 */
export enum PredicateType {
  TEST = 'PredicateType.Test',
  AND = 'PredicateType.And',
  OR = 'PredicateType.Or',
  XOR = 'PredicateType.Xor',
  NOT = 'PredicateType.Not',
}

/**
 * Discriminates the logical combinations of a subject-less condition
 * combinator tree, as used by match branches. Unlike PredicateType, whose
 * TEST leaves carry their own subject, these trees combine bare conditions
 * and take their subject from the surrounding match expression.
 */
export enum ConditionCombinatorType {
  AND = 'ConditionCombinatorType.And',
  OR = 'ConditionCombinatorType.Or',
  XOR = 'ConditionCombinatorType.Xor',
  NOT = 'ConditionCombinatorType.Not',
}

/**
 * Discriminates lifecycle hooks: access hooks run on every request, submit
 * hooks run on form submission.
 */
export enum HookType {
  ACCESS = 'HookType.Access',
  SUBMIT = 'HookType.Submit',
}

/**
 * Discriminates the outcomes a hook can halt with: a redirect or a thrown
 * error.
 */
export enum OutcomeType {
  REDIRECT = 'Outcome.Redirect',
  THROW_ERROR = 'Outcome.ThrowError',
}
