import { FunctionType, ExpressionType, PredicateType, HookType, IteratorType, OutcomeType } from './enums'

/**
 * Represents a reference to a value in the form context.
 * References are resolved at runtime to access data from various sources.
 *
 * @example
 * // Reference to a form field answer
 * { type: 'ExpressionType.Reference', path: ['answers', 'email'] }
 *
 * @example
 * // Reference to external data
 * { type: 'ExpressionType.Reference', path: ['data', 'user', 'role'] }
 *
 * @example
 * // Reference to current field (self)
 * { type: 'ExpressionType.Reference', path: ['@self'] }
 *
 * @example
 * // Reference to current collection item
 * { type: 'ExpressionType.Reference', path: ['@scope', '0', 'id'] }
 *
 * @example
 * // Reference to current loop metadata
 * { type: 'ExpressionType.Reference', path: ['@loop', '0', 'index0'] }
 */
export interface ReferenceExpr {
  type: ExpressionType.REFERENCE

  /**
   * Path segments to traverse to reach the target value.
   * Special paths include '@self' (current field), '@scope' (current iterator item),
   * and '@loop' (current iterator metadata).
   */
  path: string[]

  /**
   * Optional base expression to evaluate first.
   * When present, the reference evaluates the base expression and then
   * navigates into the result using the path segments.
   *
   * @example
   * // Navigate into the result of an iteration
   * {
   *   type: 'ExpressionType.Reference',
   *   base: { type: 'ExpressionType.Iterate', ... },
   *   path: ['goals']
   * }
   */
  base?: ResolvableValue
}

/**
 * Represents a pipeline of sequential transformations.
 * The output of each step becomes the input to the next step,
 * allowing for complex data transformations through composition.
 *
 * @example
 * // Chain multiple transformations
 * {
 *   type: 'ExpressionType.Pipeline',
 *   input: { type: 'ExpressionType.Reference', path: ['answers', 'email'] },
 *   steps: [
 *     { type: 'FunctionType.Transformer', name: 'trim', arguments: [] },
 *     { type: 'FunctionType.Transformer', name: 'toLowerCase', arguments: [] },
 *     { type: 'FunctionType.Transformer', name: 'validateEmail', arguments: [] }
 *   ]
 * }
 *
 * @example
 * // Transform with arguments
 * {
 *   type: 'ExpressionType.Pipeline',
 *   input: { type: 'ExpressionType.Reference', path: ['answers', 'price'] },
 *   steps: [
 *     { type: 'FunctionType.Transformer', name: 'multiply', arguments: [1.2] },
 *     { type: 'FunctionType.Transformer', name: 'round', arguments: [2] },
 *     { type: 'FunctionType.Transformer', name: 'formatCurrency', arguments: ['GBP'] }
 *   ]
 * }
 */
export interface PipelineExpr {
  type: ExpressionType.PIPELINE

  /**
   * Initial value expression to be transformed.
   * This value is passed as input to the first step.
   */
  input: ResolvableValue

  /**
   * Ordered array of transformation steps.
   * Each step receives the output of the previous step as its input.
   */
  steps: TransformerFunctionExpr[]
}

/**
 * Base interface for all function call expressions with typed arguments.
 * This serves as the foundation for specific function types like conditions and transformers.
 */
export interface BaseFunctionExpr<A extends ResolvableValue[]> {
  type: FunctionType
  /**
   * Name of the registered function.
   * Must match a function in the appropriate registry. Built-in functions
   * register under PascalCase names, namespaced where grouped (e.g.
   * `'IsRequired'`, `'Date.Now'`, `'Array.Slice'`); custom functions use
   * whatever name they were registered with.
   */
  name: string

  /** Arguments to pass to the function. */
  arguments: A
}

/**
 * Represents a condition function call expression.
 * Condition functions evaluate to boolean values for validation and logic predicates.
 *
 * @example
 * // Required validation condition
 * {
 *   type: 'FunctionType.Condition',
 *   name: 'IsRequired',
 *   arguments: []
 * }
 *
 * @example
 * // Length validation with parameter
 * {
 *   type: 'FunctionType.Condition',
 *   name: 'hasMaxLength',
 *   arguments: [100]
 * }
 *
 * @example
 * // Range validation with multiple parameters
 * {
 *   type: 'FunctionType.Condition',
 *   name: 'isBetween',
 *   arguments: [10, 100]
 * }
 */
export interface ConditionFunctionExpr<A extends ResolvableValue[] = ResolvableValue[]> extends BaseFunctionExpr<A> {
  type: FunctionType.CONDITION
}

/**
 * Generic function expression that can represent any function type.
 * Used when the specific function type is not known at compile time.
 */
export type FunctionExpr<A extends ResolvableValue[]> = BaseFunctionExpr<A>

/**
 * Represents a transformer function call expression.
 * Transformer functions modify values for formatting, extraction, or type conversion.
 *
 * @example
 * // Transform to uppercase
 * {
 *   type: 'FunctionType.Transformer',
 *   name: 'toUpperCase',
 *   arguments: []
 * }
 *
 * @example
 * // Extract regex capture group
 * {
 *   type: 'FunctionType.Transformer',
 *   name: 'regexCapture',
 *   arguments: ['^item-(.+)$', 1]
 * }
 */
export interface TransformerFunctionExpr<A extends ResolvableValue[] = ResolvableValue[]> extends BaseFunctionExpr<A> {
  type: FunctionType.TRANSFORMER
}

/**
 * Represents a side effect to be executed during lifecycle hooks.
 * Effects handle actions like saving data, manipulating collections,
 * or triggering external operations.
 *
 * @example
 * // Save effect
 * {
 *   type: 'FunctionType.Effect',
 *   name: 'save',
 *   arguments: [{ draft: true }]
 * }
 *
 * @example
 * // Add to collection effect
 * {
 *   type: 'FunctionType.Effect',
 *   name: 'addToCollection',
 *   arguments: [
 *     { type: 'ExpressionType.Reference', path: ['answers', 'addresses'] },
 *     { street: '', city: '', postcode: '' }
 *   ]
 * }
 */
export interface EffectFunctionExpr<A extends ResolvableValue[] = ResolvableValue[]> extends BaseFunctionExpr<A> {
  type: FunctionType.EFFECT
}

/**
 * Represents a generator function call expression.
 * Generator functions produce values without requiring input.
 * Unlike conditions and transformers, generators do not receive a value to process.
 *
 * @example
 * // Generate current date
 * {
 *   type: 'FunctionType.Generator',
 *   name: 'Date.Now',
 *   arguments: []
 * }
 *
 * @example
 * // Generate UUID with prefix
 * {
 *   type: 'FunctionType.Generator',
 *   name: 'UUID',
 *   arguments: ['prefix-']
 * }
 */
export interface GeneratorFunctionExpr<A extends ResolvableValue[] = ResolvableValue[]> extends BaseFunctionExpr<A> {
  type: FunctionType.GENERATOR
}

/**
 * Configuration for Iterator.Map - transforms each item to a new shape.
 *
 * @example
 * Iterator.Map({ label: Item().path('name'), value: Item().path('id') })
 */
export interface MapIteratorConfig {
  type: IteratorType.MAP

  /**
   * Template with Item() references - evaluated per item to produce output.
   * The template is instantiated for each item with Item() references resolved.
   */
  yield: unknown
}

/**
 * Configuration for Iterator.Filter - keeps items matching a predicate.
 *
 * @example
 * Iterator.Filter(Item().path('active').match(Condition.Equals(true)))
 */
export interface FilterIteratorConfig {
  type: IteratorType.FILTER

  /**
   * Predicate evaluated per item - items where predicate is true are kept.
   * Uses Item() references to access item properties.
   */
  predicate: PredicateExpr
}

/**
 * Configuration for Iterator.Find - returns first item matching a predicate.
 *
 * @example
 * Iterator.Find(Item().path('id').match(Condition.Equals(Params('userId'))))
 */
export interface FindIteratorConfig {
  type: IteratorType.FIND

  /**
   * Predicate evaluated per item - returns first item where predicate is true.
   * Returns undefined if no match found.
   */
  predicate: PredicateExpr
}

/**
 * Union of all iterator configuration types.
 */
export type IteratorConfig = MapIteratorConfig | FilterIteratorConfig | FindIteratorConfig

/**
 * Represents an iterate expression that applies an iterator to a source collection.
 * Created by the .each() method on reference/expression builders.
 *
 * @example
 * // Filter and map in sequence
 * Data('items')
 *   .each(Iterator.Filter(Item().path('active').match(Condition.Equals(true))))
 *   .each(Iterator.Map({ label: Item().path('name'), value: Item().path('id') }))
 *
 * @example
 * // Transform with pipeline on result
 * Data('items')
 *   .each(Iterator.Map(Item().path('name')))
 *   .pipe(Transformer.Array.Slice(0, 10))
 */
export interface IterateExpr {
  type: ExpressionType.ITERATE

  /**
   * The input source expression (array or prior iterate result).
   * Can be a reference, pipeline, or another iterate expression for chaining.
   */
  input: ResolvableValue

  /**
   * The iterator configuration (Map, Filter, etc.) to apply per item.
   */
  iterator: IteratorConfig
}

/**
 * Represents any expression that evaluates to a value.
 * This is the base type for all expressions in the form system.
 */
export type ResolvableValue =
  | ReferenceExpr
  | TransformerFunctionExpr
  | GeneratorFunctionExpr
  | PipelineExpr
  | IterateExpr
  | ResolvableValue[]
  | string
  | number
  | boolean
  | null
  | Record<string, any>

/* ===== Predicates ===== */
/**
 * Represents a test predicate that evaluates a condition against a subject.
 *
 * @example
 * // Test if field is required (not empty)
 * {
 *   type: 'PredicateType.Test',
 *   subject: { type: 'ExpressionType.Reference', path: ['@self'] },
 *   negate: false,
 *   condition: { type: 'FunctionType.Condition', name: 'IsRequired', arguments: [] }
 * }
 *
 * @example
 * // Test if email is NOT valid (negated)
 * {
 *   type: 'PredicateType.Test',
 *   subject: { type: 'ExpressionType.Reference', path: ['answers', 'email'] },
 *   negate: true,
 *   condition: { type: 'FunctionType.Condition', name: 'Email.IsValidEmail', arguments: [] }
 * }
 */
export interface PredicateTestExpr {
  type: PredicateType.TEST
  /** The value expression to test. */
  subject: ResolvableValue

  /**
   * Whether to negate the condition result.
   * If true, the predicate passes when the condition returns false.
   */
  negate: boolean

  /** The registered condition function to evaluate against the subject. */
  condition: ConditionFunctionExpr<any>
}

/**
 * Represents an AND logical predicate where all operands must be true.
 *
 * @example
 * // AND logic - all must be true
 * {
 *   type: 'PredicateType.And',
 *   operands: [
 *     { type: 'PredicateType.Test', subject: {...}, negate: false, condition: {...} },
 *     { type: 'PredicateType.Test', subject: {...}, negate: false, condition: {...} }
 *   ]
 * }
 */
export interface PredicateAndExpr {
  type: PredicateType.AND

  /**
   * Array of predicates that must all be true.
   * Requires at least 2 operands for logical AND.
   */
  operands: [PredicateExpr, PredicateExpr, ...PredicateExpr[]]
}

/**
 * Represents an OR logical predicate where at least one operand must be true.
 *
 * @example
 * // OR logic - at least one must be true
 * {
 *   type: 'PredicateType.Or',
 *   operands: [
 *     { type: 'PredicateType.Test', subject: {...}, negate: false, condition: {...} },
 *     { type: 'PredicateType.Test', subject: {...}, negate: false, condition: {...} }
 *   ]
 * }
 */
export interface PredicateOrExpr {
  type: PredicateType.OR

  /**
   * Array of predicates where at least one must be true.
   * Requires at least 2 operands for logical OR.
   */
  operands: [PredicateExpr, PredicateExpr, ...PredicateExpr[]]
}

/**
 * Represents an XOR logical predicate where exactly one operand must be true.
 *
 * @example
 * // XOR logic - exactly one must be true
 * {
 *   type: 'PredicateType.Xor',
 *   operands: [
 *     { type: 'PredicateType.Test', subject: {...}, negate: false, condition: {...} },
 *     { type: 'PredicateType.Test', subject: {...}, negate: false, condition: {...} }
 *   ]
 * }
 */
export interface PredicateXorExpr {
  type: PredicateType.XOR

  /**
   * Array of predicates where exactly one must be true.
   * Requires at least 2 operands for logical XOR.
   */
  operands: [PredicateExpr, PredicateExpr, ...PredicateExpr[]]
}

/**
 * Represents a NOT logical predicate that inverts the operand's result.
 *
 * @example
 * // NOT logic - invert the result
 * {
 *   type: 'PredicateType.Not',
 *   operand: { type: 'PredicateType.Test', subject: {...}, negate: false, condition: {...} }
 * }
 */
export interface PredicateNotExpr {
  type: PredicateType.NOT

  /**
   * Single predicate to negate.
   * NOT requires exactly one operand.
   */
  operand: PredicateExpr
}

/**
 * Represents any predicate expression that evaluates to true or false.
 * Used for validation rules, conditional logic, and guards.
 */
export type PredicateExpr = PredicateTestExpr | PredicateAndExpr | PredicateOrExpr | PredicateXorExpr | PredicateNotExpr

/**
 * Represents a conditional expression that evaluates to different values based on a predicate.
 * Follows the if-then-else pattern
 *
 * @example
 * // Simple validation rule
 * {
 *   type: 'ExpressionType.Conditional',
 *   predicate: {
 *     type: 'PredicateType.Test',
 *     subject: { type: 'ExpressionType.Reference', path: ['@self'] },
 *     negate: true,
 *     condition: { type: 'FunctionType.Condition', name: 'IsRequired', arguments: [] }
 *   },
 *   thenValue: 'This field is required',
 *   elseValue: false
 * }
 *
 * @example
 * // Conditional field visibility (dependentWhen)
 * {
 *   type: 'ExpressionType.Conditional',
 *   predicate: {
 *     type: 'PredicateType.Test',
 *     subject: { type: 'ExpressionType.Reference', path: ['answers', 'hasChildren'] },
 *     negate: false,
 *     condition: { type: 'FunctionType.Condition', name: 'Equals', arguments: [true] }
 *   },
 *   thenValue: true,
 *   elseValue: false
 * }
 *
 * @example
 * // Nested conditionals for complex logic
 * {
 *   type: 'ExpressionType.Conditional',
 *   predicate: { type: 'PredicateType.Test', subject: {...}, negate: false, condition: {...} },
 *   thenValue: {
 *     type: 'ExpressionType.Conditional',
 *     predicate: { type: 'PredicateType.Test', subject: {...}, negate: false, condition: {...} },
 *     thenValue: 'Option A',
 *     elseValue: 'Option B'
 *   },
 *   elseValue: 'Option C'
 * }
 */
export interface ConditionalExpr {
  type: ExpressionType.CONDITIONAL

  /** The condition to evaluate. */
  predicate: PredicateExpr

  /**
   * The value to return when the predicate evaluates to true.
   * If omitted, defaults to true.
   */
  thenValue?: ResolvableValue

  /**
   * The value to return when the predicate evaluates to false.
   * If omitted, defaults to false.
   */
  elseValue?: ResolvableValue
}

/**
 * Represents a single branch in a match expression.
 * Each branch pairs a condition with a value to return when the condition matches.
 */
export interface MatchBranch {
  /** The condition to evaluate against the match subject. */
  condition: ConditionFunctionExpr<any>

  /** The value to return when this branch's condition matches. */
  value: ResolvableValue
}

/**
 * Represents a match expression that evaluates a subject against multiple branches.
 * Returns the value of the first branch whose condition matches, or the otherwise value.
 *
 * @example
 * // Match on status
 * {
 *   type: 'ExpressionType.Match',
 *   subject: { type: 'ExpressionType.Reference', path: ['data', 'status'] },
 *   branches: [
 *     { condition: { type: 'FunctionType.Condition', name: 'Equals', arguments: ['ACTIVE'] }, value: 'Active' },
 *     { condition: { type: 'FunctionType.Condition', name: 'Equals', arguments: ['CLOSED'] }, value: 'Closed' },
 *   ],
 *   otherwise: 'Unknown'
 * }
 */
export interface MatchExpr {
  type: ExpressionType.MATCH

  /** The value to test each branch's condition against. */
  subject: ResolvableValue

  /** Ordered array of branches. The first matching branch's value is returned. */
  branches: MatchBranch[]

  /**
   * The value to return when no branch matches.
   * If omitted, defaults to undefined.
   */
  otherwise?: ResolvableValue
}

/* ===== Hook Outcomes ===== */

/**
 * Represents a redirect outcome in a hook.
 * When matched, halts hook processing and redirects to the specified path.
 *
 * @example
 * // Unconditional redirect
 * redirect({ goto: '/overview' })
 *
 * @example
 * // Conditional redirect
 * redirect({
 *   when: Data('needsSetup').match(Condition.Equals(true)),
 *   goto: '/setup',
 * })
 */
export interface RedirectOutcome {
  type: OutcomeType.REDIRECT
  /** Optional condition that must be true for this redirect to occur. */
  when?: PredicateExpr
  /** The path to redirect to. */
  goto: string | ResolvableValue
}

/**
 * Represents an error outcome in a hook.
 * When matched, halts hook processing and returns an error outcome.
 *
 * @example
 * // Not found error
 * throwError({
 *   when: Data('notFound').match(Condition.Equals(true)),
 *   status: 404,
 *   message: 'Item not found',
 * })
 *
 * @example
 * // Dynamic error message
 * throwError({
 *   when: Data('saveError').match(Condition.IsRequired()),
 *   status: 500,
 *   message: Format('Failed to save: %1', Data('saveError')),
 * })
 */
export interface ThrowErrorOutcome {
  type: OutcomeType.THROW_ERROR
  /** Optional condition that must be true for this error to be thrown. */
  when?: PredicateExpr
  /** HTTP status code to return. */
  status: number
  /** Error message to return. */
  message: string | ResolvableValue
}

/**
 * Union type for all hook outcomes.
 * Used in the `next` array of access and submit hooks.
 */
export type HookOutcome = RedirectOutcome | ThrowErrorOutcome

/**
 * Lifecycle hook for access control and data loading.
 *
 * Access hooks are evaluated in sequence. Each hook:
 * 1. Evaluates `when` condition (if present)
 * 2. If `when` is false → skip to next hook
 * 3. If `when` is true (or absent) → execute effects
 * 4. Evaluate `next` outcomes - first match halts (redirect or error)
 * 5. If no outcome matches → CONTINUE to next hook
 *
 * @example
 * // Effects-only hook (always executes, continues)
 * access({ effects: [loadUserData()] })
 *
 * @example
 * // Conditional redirect
 * access({
 *   when: Data('user').not.match(Condition.IsRequired()),
 *   next: [redirect({ goto: '/login' })],
 * })
 *
 * @example
 * // Error response
 * access({
 *   effects: [checkPermissions()],
 *   next: [
 *     throwError({
 *       when: Data('notFound').match(Condition.Equals(true)),
 *       status: 404,
 *       message: 'Item not found',
 *     }),
 *     redirect({ goto: '/overview' }),
 *   ],
 * })
 */
export interface AccessHook {
  type: HookType.ACCESS
  /** Condition for this hook to execute. If omitted, always executes. */
  when?: PredicateExpr
  /** Effects to execute when hook runs (data loading, analytics, etc.) */
  effects?: EffectFunctionExpr<any>[]
  /** Outcomes to evaluate - first match halts (redirect or throws error) */
  next?: HookOutcome[]
}

/**
 * Submission hook for handling form submissions.
 * Controls validation, effects, and navigation when users submit forms.
 *
 * @example
 * // Simple save and redirect
 * submit({
 *   validate: true,
 *   onValid: {
 *     effects: [saveData()],
 *     next: [redirect({ goto: '/confirmation' })],
 *   },
 * })
 *
 * @example
 * // Error handling on save failure
 * submit({
 *   validate: true,
 *   onValid: {
 *     effects: [saveGoal()],
 *     next: [
 *       throwError({
 *         when: Data('saveError').match(Condition.IsRequired()),
 *         status: 500,
 *         message: Format('Failed to save: %1', Data('saveError')),
 *       }),
 *       redirect({ goto: '/goals/overview' }),
 *     ],
 *   },
 * })
 */
export interface SubmitHook {
  type: HookType.SUBMIT

  /**
   * Optional trigger condition for this hook.
   * If omitted, the hook triggers on any form submission.
   */
  when?: PredicateExpr

  /**
   * Optional guard conditions that must be met for the hook to proceed.
   * Guards act as a security layer, preventing hooks in certain states.
   */
  guards?: PredicateExpr

  /**
   * Whether to validate form fields before proceeding.
   * When true, validates the default validation group; when passed a group
   * list, validates those groups instead.
   * When false (default), no fresh validation runs — branches route on the
   * step's already-recorded validity.
   */
  validate?: boolean | { groups: string[] }

  /**
   * Actions to execute regardless of validation result, before any routing
   * to onValid or onInvalid.
   */
  onAlways?: {
    /** Effects to execute */
    effects?: EffectFunctionExpr<any>[]
    /** Outcomes to evaluate - first match halts (redirect or throws error) */
    next?: HookOutcome[]
  }

  /**
   * Actions to execute when the step's recorded validation state is valid.
   * With validate false this can still run, since a step with no recorded
   * failures reads as valid.
   */
  onValid?: {
    /** Effects to execute */
    effects?: EffectFunctionExpr<any>[]
    /** Outcomes to evaluate - first match halts (redirect or throws error) */
    next?: HookOutcome[]
  }

  /**
   * Actions to execute when the step's recorded validation state has
   * failures, whether recorded by this hook's validation or earlier in the
   * same request.
   */
  onInvalid?: {
    /** Effects to execute */
    effects?: EffectFunctionExpr<any>[]
    /** Outcomes to evaluate - first match halts (redirect or throws error) */
    next?: HookOutcome[]
  }
}
