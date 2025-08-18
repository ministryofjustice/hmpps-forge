/**
 * Represents a reference to a value in the form context.
 * References are resolved at runtime to access data from various sources.
 *
 * @example
 * // Reference to a form field answer
 * { type: 'reference', path: ['answers', 'email'] }
 *
 * @example
 * // Reference to external data
 * { type: 'reference', path: ['data', 'user', 'role'] }
 *
 * @example
 * // Reference to current field (self)
 * { type: 'reference', path: ['@self'] }
 *
 * @example
 * // Reference to current collection item
 * { type: 'reference', path: ['@item', 'id'] }
 */
export interface ReferenceExpr {
  type: 'reference'

  /**
   * Path segments to traverse to reach the target value.
   * Special paths include '@self' (current field) and '@item' (current collection item).
   */
  path: string[]
}

/**
 * Represents a string formatting expression with placeholder substitution.
 * Placeholders are denoted as %1, %2, etc., and are replaced with the corresponding
 * argument values at runtime.
 *
 * @example
 * // Simple string formatting
 * {
 *   type: 'format',
 *   text: 'Hello %1, you are %2 years old',
 *   args: [
 *     { type: 'reference', path: ['answers', 'name'] },
 *     { type: 'reference', path: ['answers', 'age'] }
 *   ]
 * }
 *
 * @example
 * // Dynamic field code generation in collections
 * {
 *   type: 'format',
 *   text: 'address_%1_street',
 *   args: [{ type: 'reference', path: ['@item', 'id'] }]
 * }
 */
export interface FormatExpr {
  type: 'format'

  /**
   * Template string containing placeholders (%1, %2, etc.).
   * Placeholders are 1-indexed and correspond to the args array.
   */
  text: string

  /**
   * Array of expressions whose values will replace the placeholders.
   * The first argument replaces %1, second replaces %2, and so on.
   */
  args: ValueExpr[]
}

/**
 * Represents a single data transformation function.
 * Transformers are registered functions that modify values,
 * such as formatting, extraction, or type conversion.
 *
 * @example
 * // Transform to uppercase
 * {
 *   type: 'transformer',
 *   name: 'toUpperCase',
 *   args: []
 * }
 *
 * @example
 * // Extract regex capture group
 * {
 *   type: 'transformer',
 *   name: 'regexCapture',
 *   args: ['^item-(.+)$', 1]
 * }
 */
export interface TransformerExpr {
  type: 'transformer'

  /**
   * Name of the registered transformer function.
   * Must match a function in the transformer registry.
   */
  name: string

  /**
   * Arguments to pass to the transformer function.
   * The transformed value is always the implicit first argument.
   */
  args: ValueExpr[]
}

/**
 * Represents a pipeline of sequential transformations.
 * The output of each step becomes the input to the next step,
 * allowing for complex data transformations through composition.
 *
 * @example
 * // Chain multiple transformations
 * {
 *   type: 'pipeline',
 *   input: { type: 'reference', path: ['answers', 'email'] },
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
 *   type: 'pipeline',
 *   input: { type: 'reference', path: ['answers', 'price'] },
 *   steps: [
 *     { name: 'multiply', args: [1.2] },
 *     { name: 'round', args: [2] },
 *     { name: 'formatCurrency', args: ['GBP'] }
 *   ]
 * }
 */
export interface PipelineExpr {
  type: 'pipeline'

  /**
   * Initial value expression to be transformed.
   * This value is passed as input to the first step.
   */
  input: ValueExpr

  /**
   * Ordered array of transformation steps.
   * Each step receives the output of the previous step as its input.
   */
  steps: {
    /** Name of the registered transformer function */
    name: string

    /** Optional arguments for the transformer (beyond the piped value) */
    args?: ValueExpr[]
  }[]
}

/**
 * Represents a function call expression with typed arguments.
 * Functions are used for conditions (validation) and transformers.
 *
 * @example
 * // Validation function
 * {
 *   type: 'function',
 *   name: 'hasMaxLength',
 *   arguments: [100]
 * }
 *
 * @example
 * // Condition function with multiple arguments
 * {
 *   type: 'function',
 *   name: 'isBetween',
 *   arguments: [10, 100]
 * }
 */
export type FunctionExpr<A extends readonly ValueExpr[]> = {
  type: 'function'
  /**
   * Name of the registered function.
   * Must match a function in the appropriate registry (condition or transformer).
   */
  name: string

  /** Arguments to pass to the function. */
  arguments: A
}

/**
 * Represents a side effect to be executed during transitions.
 * Effects handle actions like saving data, manipulating collections,
 * or triggering external operations.
 **
 * @example
 * // Save effect
 * {
 *   type: 'effect',
 *   name: 'save',
 *   arguments: [{ draft: true }]
 * }
 *
 * @example
 * // Add to collection effect
 * {
 *   type: 'effect',
 *   name: 'addToCollection',
 *   arguments: [
 *     { type: 'reference', path: ['answers', 'addresses'] },
 *     { street: '', city: '', postcode: '' }
 *   ]
 * }
 */
export type EffectExpr<A extends readonly ValueExpr[]> = {
  type: 'effect'

  /** Name of the registered effect handler. */
  name: string

  /** Arguments to pass to the effect handler. */
  arguments: A
}

/**
 * Represents any expression that evaluates to a value.
 * This is the base type for all expressions in the form system.
 */
export type ValueExpr =
  | ReferenceExpr
  | FormatExpr
  | TransformerExpr
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
 *   type: 'test',
 *   subject: { type: 'reference', path: ['@self'] },
 *   negate: false,
 *   condition: { type: 'function', name: 'isRequired', arguments: [] }
 * }
 *
 * @example
 * // Test if email is NOT valid (negated)
 * {
 *   type: 'test',
 *   subject: { type: 'reference', path: ['answers', 'email'] },
 *   negate: true,
 *   condition: { type: 'function', name: 'isEmail', arguments: [] }
 * }
 */
export interface PredicateTestExpr {
  type: 'test'
  /** The value expression to test. */
  subject: ValueExpr

  /**
   * Whether to negate the condition result.
   * If true, the predicate passes when the condition returns false.
   */
  negate: boolean

  /** The registered condition function to evaluate against the subject. */
  condition: FunctionExpr<any>
}

/**
 * Represents a logical combination of predicates.
 *
 * @example
 * // AND logic - all must be true
 * {
 *   type: 'logic',
 *   op: 'and',
 *   operands: [
 *     { type: 'test', subject: {...}, negate: false, condition: {...} },
 *     { type: 'test', subject: {...}, negate: false, condition: {...} }
 *   ]
 * }
 *
 * @example
 * // OR logic - at least one must be true
 * {
 *   type: 'logic',
 *   op: 'or',
 *   operands: [...]
 * }
 *
 * @example
 * // XOR logic - exactly one must be true
 * {
 *   type: 'logic',
 *   op: 'xor',
 *   operands: [...]
 * }
 *
 * @example
 * // NOT logic - invert the result
 * {
 *   type: 'logic',
 *   op: 'not',
 *   operands: [{ type: 'test', ... }]
 * }
 */
export interface PredicateLogicExpr {
  type: 'logic'

  /**
   * The logical operator to apply.
   * - 'and': All operands must be true
   * - 'or': At least one operand must be true
   * - 'xor': Exactly one operand must be true
   * - 'not': Inverts the result (requires exactly one operand)
   */
  op: 'and' | 'or' | 'xor' | 'not'

  /**
   * Array of predicates to combine with the logical operator.
   * Can include both test predicates and nested logic predicates.
   */
  operands: PredicateExpr[]
}

/**
 * Represents any predicate expression that evaluates to true or false.
 * Used for validation rules, conditional logic, and guards.
 */
export type PredicateExpr = PredicateTestExpr | PredicateLogicExpr

/**
 * Represents a conditional expression that evaluates to different values based on a predicate.
 * Follows the if-then-else pattern
 *
 * @example
 * // Simple validation rule
 * {
 *   type: 'conditional',
 *   predicate: {
 *     type: 'test',
 *     subject: { type: 'reference', path: ['@self'] },
 *     negate: true,
 *     condition: { type: 'function', name: 'isRequired', arguments: [] }
 *   },
 *   thenValue: 'This field is required',
 *   elseValue: false
 * }
 *
 * @example
 * // Conditional field visibility (dependent)
 * {
 *   type: 'conditional',
 *   predicate: {
 *     type: 'test',
 *     subject: { type: 'reference', path: ['answers', 'hasChildren'] },
 *     negate: false,
 *     condition: { type: 'function', name: 'matchesValue', arguments: [true] }
 *   },
 *   thenValue: true,
 *   elseValue: false
 * }
 *
 * @example
 * // Nested conditionals for complex logic
 * {
 *   type: 'conditional',
 *   predicate: { type: 'test', subject: {...}, condition: {...} },
 *   thenValue: {
 *     type: 'conditional',
 *     predicate: { type: 'test', subject: {...}, condition: {...} ,
 *     thenValue: 'Option A',
 *     elseValue: 'Option B'
 *   },
 *   elseValue: 'Option C'
 * }
 */
export interface ConditionalExpr {
  type: 'conditional'

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
 * Base interface for all transition types.
 * Transitions control how users move between steps in a journey.
 */
interface TransitionBase {
  type: 'transition'

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
 *     effects: [{ type: 'effect', name: 'save', arguments: [{ draft: true }] }],
 *     next: [{ goto: '/dashboard' }]
 *   }
 * }
 */
export interface SkipValidationTransition extends TransitionBase {
  /** Must be false to skip validation */
  validate: false

  /** Actions to execute */
  onAlways: {
    /** Optional effects to execute (save, manipulate collections, etc.) */
    effects?: EffectExpr<any>[]

    /** Required navigation rules for where to go next */
    next: NextExpr[]
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
 *     effects: [{ type: 'effect', name: 'save', arguments: [] }],
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
 *     effects: [{ type: 'effect', name: 'log', arguments: ['submission attempt'] }]
 *   },
 *   onValid: {...},
 *   onInvalid: {...}
 * }
 */
export interface ValidatingTransition extends TransitionBase {
  /** Must be true to trigger validation */
  validate: true

  /**
   * Optional actions to execute before validation occurs.
   * Useful for logging or preparatory effects.
   */
  onAlways?: {
    /** Effects to execute before validation */
    effects?: EffectExpr<any>[]
  }

  /** Actions to execute when validation passes. */
  onValid: {
    /** Optional effects to execute */
    effects?: EffectExpr<any>[]
    /** Required navigation rules on successful validation */
    next: NextExpr[]
  }

  /** Actions to execute when validation fails. */
  onInvalid: {
    /** Optional effects to execute */
    effects?: EffectExpr<any>[]
    /** Required navigation rules on failed validation */
    next: NextExpr[]
  }
}

/**
 * Represents any transition expression.
 * Transitions define how users move through form journeys,
 * including validation, effects, and navigation logic.
 */
export type TransitionExpr = SkipValidationTransition | ValidatingTransition
