/**
 * Discriminates the four kinds of stored function invocation: conditions test
 * values, transformers reshape them, generators produce them, and effects
 * perform side effects in hooks.
 */
export enum FunctionCallType {
  CONDITION = 'function.call.condition',
  TRANSFORMER = 'function.call.transformer',
  GENERATOR = 'function.call.generator',
  EFFECT = 'function.call.effect',
}

/**
 * Discriminates the four kinds of registered function entry a call can
 * target. Pairs with FunctionCallType by leaf name.
 */
export enum FunctionEntryType {
  CONDITION = 'function.entry.condition',
  TRANSFORMER = 'function.entry.transformer',
  GENERATOR = 'function.entry.generator',
  EFFECT = 'function.entry.effect',
}

/**
 * Discriminates the structural containers a form is built from: journeys
 * contain steps.
 */
export enum StructureType {
  BLOCK = 'StructureType.Block',
  JOURNEY = 'structure.journey',
  STEP = 'structure.step',
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
 * Discriminates stored component calls: field blocks collect answers, basic
 * blocks only display content.
 */
export enum ComponentCallType {
  BASIC = 'component.call.basic',
  FIELD = 'component.call.field',
}

/**
 * Discriminates registered component entries, the handles component()
 * returns. Pairs with ComponentCallType by leaf name.
 */
export enum ComponentEntryType {
  BASIC = 'component.entry.basic',
  FIELD = 'component.entry.field',
}

/**
 * Discriminates value expression nodes: nodes the engine can evaluate, on
 * their own, to a value.
 */
export enum ExpressionType {
  REFERENCE = 'expression.reference',
  PIPELINE = 'expression.pipeline',
  CONDITIONAL = 'expression.conditional',
  MATCH = 'expression.match',
  ITERATE = 'expression.iterate',
}

/**
 * Discriminates policy nodes: rules that decide what may happen — validation,
 * navigation, and hook halt outcomes.
 */
export enum PolicyType {
  VALIDATION_RULE = 'policy.validation.rule',
  NAVIGATION_NEXT = 'policy.navigation.next',
  NAVIGATION_TIE_BREAKER = 'policy.navigation.tie-breaker',
  OUTCOME_REDIRECT = 'policy.outcome.redirect',
  OUTCOME_THROW_ERROR = 'policy.outcome.throw-error',
}

/**
 * Discriminates the per-item operations an iterate expression can apply to
 * a collection.
 */
export enum IteratorType {
  MAP = 'iterator.map',
  FILTER = 'iterator.filter',
  FIND = 'iterator.find',
}

/**
 * Discriminates predicate nodes: a single condition test, or a logical
 * combination of other predicates.
 */
export enum PredicateType {
  TEST = 'predicate.test',
  AND = 'predicate.and',
  OR = 'predicate.or',
  XOR = 'predicate.xor',
  NOT = 'predicate.not',
}

/**
 * Discriminates the logical combinations of a subject-less condition
 * combinator tree, as used by match branches. Unlike PredicateType, whose
 * TEST leaves carry their own subject, these trees combine bare conditions
 * and take their subject from the surrounding match expression.
 */
export enum ConditionCombinatorType {
  AND = 'combinator.and',
  OR = 'combinator.or',
  XOR = 'combinator.xor',
  NOT = 'combinator.not',
}

/**
 * Discriminates lifecycle hooks: access hooks run on every request, submit
 * hooks run on form submission.
 */
export enum HookType {
  ACCESS = 'hook.access',
  SUBMIT = 'hook.submit',
}

/**
 * Discriminates the live authoring builder objects, turned into stored nodes
 * at finalisation.
 */
export enum BuilderType {
  REFERENCE = 'builder.reference',
  CHAIN = 'builder.chain',
  CONDITIONAL = 'builder.conditional',
  MATCH = 'builder.match',
  GENERATOR = 'builder.generator',
  ITERABLE = 'builder.iterable',
  SCOPED_REFERENCE = 'builder.scoped-reference',
  LOOP_ITEM = 'builder.loop-item',
  LOOP = 'builder.loop',
}
