import { FunctionType, ExpressionType, LogicType, TransitionType } from './enums'

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
 * { type: 'ExpressionType.Reference', path: ['@item', 'id'] }
 */
export interface ReferenceExpr {
  type: ExpressionType.REFERENCE

  /**
   * Path segments to traverse to reach the target value.
   * Special paths include '@self' (current field) and '@item' (current collection item).
   */
  path: readonly string[]
}

/**
 * Represents a string formatting expression with placeholder substitution.
 * Placeholders are denoted as %1, %2, etc., and are replaced with the corresponding
 * argument values at runtime.
 *
 * @example
 * // Simple string formatting
 * {
 *   type: 'ExpressionType.Format',
 *   text: 'Hello %1, you are %2 years old',
 *   args: [
 *     { type: 'ExpressionType.Reference', path: ['answers', 'name'] },
 *     { type: 'ExpressionType.Reference', path: ['answers', 'age'] }
 *   ]
 * }
 *
 * @example
 * // Dynamic field code generation in collections
 * {
 *   type: 'ExpressionType.Format',
 *   text: 'address_%1_street',
 *   args: [{ type: 'ExpressionType.Reference', path: ['@item', 'id'] }]
 * }
 */
export interface FormatExpr {
  type: ExpressionType.FORMAT

  /**
   * Template string containing placeholders (%1, %2, etc.).
   * Placeholders are 1-indexed and correspond to the args array.
   */
  text: string

  /**
   * Array of expressions whose values will replace the placeholders.
   * The first argument replaces %1, second replaces %2, and so on.
   */
  args: readonly ValueExpr[]
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
 *     { name: 'trim' },
 *     { name: 'toLowerCase' },
 *     { name: 'validateEmail' }
 *   ]
 * }
 *
 * @example
 * // Transform with arguments
 * {
 *   type: 'ExpressionType.Pipeline',
 *   input: { type: 'ExpressionType.Reference', path: ['answers', 'price'] },
 *   steps: [
 *     { name: 'multiply', args: [1.2] },
 *     { name: 'round', args: [2] },
 *     { name: 'formatCurrency', args: ['GBP'] }
 *   ]
 * }
 */
export interface PipelineExpr {
  type: ExpressionType.PIPELINE

  /**
   * Initial value expression to be transformed.
   * This value is passed as input to the first step.
   */
  input: ValueExpr

  /**
   * Ordered array of transformation steps.
   * Each step receives the output of the previous step as its input.
   */
  steps: readonly {
    /** Name of the registered transformer function */
    readonly name: string

    /** Optional arguments for the transformer (beyond the piped value) */
    readonly args?: readonly ValueExpr[]
  }[]
}

/**
 * Base interface for all function call expressions with typed arguments.
 * This serves as the foundation for specific function types like conditions and transformers.
 */
export interface BaseFunctionExpr<A extends readonly ValueExpr[]> {
  type: FunctionType
  /**
   * Name of the registered function.
   * Must match a function in the appropriate registry.
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
 *   name: 'isRequired',
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
export interface ConditionFunctionExpr<A extends readonly ValueExpr[] = readonly ValueExpr[]>
  extends BaseFunctionExpr<A> {
  type: FunctionType.CONDITION
}

/**
 * Generic function expression that can represent any function type.
 * Used when the specific function type is not known at compile time.
 */
export type FunctionExpr<A extends readonly ValueExpr[]> = BaseFunctionExpr<A>

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
export interface TransformerFunctionExpr<A extends readonly ValueExpr[] = readonly ValueExpr[]>
  extends BaseFunctionExpr<A> {
  type: FunctionType.TRANSFORMER
}

/**
 * Represents a side effect to be executed during transitions.
 * Effects handle actions like saving data, manipulating collections,
 * or triggering external operations.
 **
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
export interface EffectFunctionExpr<A extends readonly ValueExpr[] = readonly ValueExpr[]> extends BaseFunctionExpr<A> {
  type: FunctionType.EFFECT
}

/**
 * Represents any expression that evaluates to a value.
 * This is the base type for all expressions in the form system.
 */
export type ValueExpr =
  | ReferenceExpr
  | FormatExpr
  | TransformerFunctionExpr
  | PipelineExpr
  | ValueExpr[]
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
 *   type: 'LogicType.Test',
 *   subject: { type: 'ExpressionType.Reference', path: ['@self'] },
 *   negate: false,
 *   condition: { type: 'FunctionType.Condition', name: 'isRequired', arguments: [] }
 * }
 *
 * @example
 * // Test if email is NOT valid (negated)
 * {
 *   type: 'LogicType.Test',
 *   subject: { type: 'ExpressionType.Reference', path: ['answers', 'email'] },
 *   negate: true,
 *   condition: { type: 'FunctionType.Condition', name: 'isEmail', arguments: [] }
 * }
 */
export interface PredicateTestExpr {
  type: LogicType.TEST
  /** The value expression to test. */
  subject: ValueExpr

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
 *   type: 'LogicType.And',
 *   operands: [
 *     { type: 'LogicType.Test', subject: {...}, negate: false, condition: {...} },
 *     { type: 'LogicType.Test', subject: {...}, negate: false, condition: {...} }
 *   ]
 * }
 */
export interface PredicateAndExpr {
  type: LogicType.AND

  /**
   * Array of predicates that must all be true.
   * Requires at least 2 operands for logical AND.
   */
  operands: readonly [PredicateExpr, PredicateExpr, ...PredicateExpr[]]
}

/**
 * Represents an OR logical predicate where at least one operand must be true.
 *
 * @example
 * // OR logic - at least one must be true
 * {
 *   type: 'LogicType.Or',
 *   operands: [
 *     { type: 'LogicType.Test', subject: {...}, condition: {...} },
 *     { type: 'LogicType.Test', subject: {...}, condition: {...} }
 *   ]
 * }
 */
export interface PredicateOrExpr {
  type: LogicType.OR

  /**
   * Array of predicates where at least one must be true.
   * Requires at least 2 operands for logical OR.
   */
  operands: readonly [PredicateExpr, PredicateExpr, ...PredicateExpr[]]
}

/**
 * Represents an XOR logical predicate where exactly one operand must be true.
 *
 * @example
 * // XOR logic - exactly one must be true
 * {
 *   type: 'LogicType.Xor',
 *   operands: [
 *     { type: 'LogicType.Test', subject: {...}, condition: {...} },
 *     { type: 'LogicType.Test', subject: {...}, condition: {...} }
 *   ]
 * }
 */
export interface PredicateXorExpr {
  type: LogicType.XOR

  /**
   * Array of predicates where exactly one must be true.
   * Requires at least 2 operands for logical XOR.
   */
  operands: readonly [PredicateExpr, PredicateExpr, ...PredicateExpr[]]
}

/**
 * Represents a NOT logical predicate that inverts the operand's result.
 *
 * @example
 * // NOT logic - invert the result
 * {
 *   type: 'LogicType.Not',
 *   operand: { type: 'LogicType.Test', subject: {...}, condition: {...} }
 * }
 */
export interface PredicateNotExpr {
  type: LogicType.NOT

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
 *   type: 'LogicType.Conditional',
 *   predicate: {
 *     type: 'LogicType.Test',
 *     subject: { type: 'ExpressionType.Reference', path: ['@self'] },
 *     negate: true,
 *     condition: { type: 'FunctionType.Condition', name: 'isRequired', arguments: [] }
 *   },
 *   thenValue: 'This field is required',
 *   elseValue: false
 * }
 *
 * @example
 * // Conditional field visibility (dependent)
 * {
 *   type: 'LogicType.Conditional',
 *   predicate: {
 *     type: 'LogicType.Test',
 *     subject: { type: 'ExpressionType.Reference', path: ['answers', 'hasChildren'] },
 *     negate: false,
 *     condition: { type: 'FunctionType.Condition', name: 'matchesValue', arguments: [true] }
 *   },
 *   thenValue: true,
 *   elseValue: false
 * }
 *
 * @example
 * // Nested conditionals for complex logic
 * {
 *   type: 'LogicType.Conditional',
 *   predicate: { type: 'LogicType.Test', subject: {...}, condition: {...} },
 *   thenValue: {
 *     type: 'LogicType.Conditional',
 *     predicate: { type: 'LogicType.Test', subject: {...}, condition: {...} ,
 *     thenValue: 'Option A',
 *     elseValue: 'Option B'
 *   },
 *   elseValue: 'Option C'
 * }
 */
export interface ConditionalExpr {
  type: LogicType.CONDITIONAL

  /** The condition to evaluate. */
  predicate: PredicateExpr

  /**
   * The value to return when the predicate evaluates to true.
   * If omitted, defaults to true.
   */
  thenValue?: ValueExpr

  /**
   * The value to return when the predicate evaluates to false.
   * If omitted, defaults to false.
   */
  elseValue?: ValueExpr
}

/* ===== Transitions ===== */

/**
 * Represents a navigation destination with optional conditional logic.
 * Defines where to navigate after a transition completes.
 *
 * @example
 * // Simple navigation
 * { goto: '/next-step' }
 *
 * @example
 * // Conditional navigation
 * {
 *   when: { type: 'test', subject: {...}, negate: false, condition: {...} },
 *   goto: '/business-flow'
 * }
 */
interface NextExpr {
  /**
   * Optional condition that must be true for this navigation to occur.
   * If omitted, this navigation always applies (useful as a fallback).
   */
  when?: PredicateExpr

  /** The path to navigate to. */
  goto: string | FormatExpr
}

/**
 * Lifecycle transition for pure data loading.
 * Runs before access control checks.
 */
export interface LoadTransition {
  /** Effects to execute for loading data */
  effects: readonly EffectFunctionExpr<any>[]
}

/**
 * Lifecycle transition for access control and non-loading effects.
 * Runs after data loading, before rendering.
 */
export interface AccessTransition {
  /** Guard conditions that must be met to access this step/journey */
  guards?: PredicateExpr

  /** Optional effects to execute (analytics, logging, etc.) */
  effects?: readonly EffectFunctionExpr<any>[]

  /** Navigation rules if guards fail */
  redirect?: readonly NextExpr[]
}

/**
 * Base interface for submission transition types.
 * Submission transitions control how users move between steps when submitting forms.
 */
interface SubmitTransitionBase {
  type: TransitionType.SUBMIT

  /**
   * Optional trigger condition for this transition.
   * If omitted, the transition triggers on any form submission.
   */
  when?: PredicateExpr

  /**
   * Optional guard conditions that must be met for the transition to proceed.
   * Guards act as a security layer, preventing transitions in certain states.
   */
  guards?: PredicateExpr
}

/**
 * Represents a transition that skips validation.
 * Used for operations that don't require data validation,
 * such as saving drafts or managing collections.
 *
 * @example
 * // Save draft without validation
 * {
 *   type: 'transition',
 *   when: { type: 'test', subject: {...}, condition: {...} },
 *   validate: false,
 *   onAlways: {
 *     effects: [{ type: 'FunctionType.Effect', name: 'save', arguments: [{ draft: true }] }],
 *     next: [{ goto: '/dashboard' }]
 *   }
 * }
 */
export interface SkipValidationTransition extends SubmitTransitionBase {
  /** Must be false to skip validation */
  validate: false

  /** Actions to execute */
  onAlways: {
    /** Optional effects to execute (save, manipulate collections, etc.) */
    effects?: readonly EffectFunctionExpr<any>[]

    /** Required navigation rules for where to go next */
    next: readonly NextExpr[]
  }
}

/**
 * Represents a transition that validates form fields before proceeding.
 *
 * @example
 * // Standard form progression with validation
 * {
 *   type: 'transition',
 *   when: { type: 'test', subject: {...}, condition: {...} },
 *   validate: true,
 *   onValid: {
 *     effects: [{ type: 'FunctionType.Effect', name: 'save', arguments: [] }],
 *     next: [{ goto: '/next-step' }]
 *   },
 *   onInvalid: {
 *     next: [{ goto: '/current-step' }]
 *   }
 * }
 *
 * @example
 * // With onAlways for effects that run before validation
 * {
 *   type: 'transition',
 *   validate: true,
 *   onAlways: {
 *     effects: [{ type: 'FunctionType.Effect', name: 'log', arguments: ['submission attempt'] }]
 *   },
 *   onValid: {...},
 *   onInvalid: {...}
 * }
 */
export interface ValidatingTransition extends SubmitTransitionBase {
  /** Must be true to trigger validation */
  validate: true

  /**
   * Optional actions to execute before validation occurs.
   * Useful for logging or preparatory effects.
   */
  onAlways?: {
    /** Effects to execute before validation */
    effects?: readonly EffectFunctionExpr<any>[]
  }

  /** Actions to execute when validation passes. */
  onValid: {
    /** Optional effects to execute */
    effects?: readonly EffectFunctionExpr<any>[]
    /** Required navigation rules on successful validation */
    next: readonly NextExpr[]
  }

  /** Actions to execute when validation fails. */
  onInvalid: {
    /** Optional effects to execute */
    effects?: readonly EffectFunctionExpr<any>[]
    /** Required navigation rules on failed validation */
    next: readonly NextExpr[]
  }
}

/**
 * Lifecycle transition for data submission.
 * Runs after data loading, on form submission.
 */
export type SubmitTransition = SkipValidationTransition | ValidatingTransition
