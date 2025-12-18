import {
  FunctionExpr,
  PipelineExpr,
  PredicateExpr,
  ReferenceExpr,
  TransformerFunctionExpr,
  SubmitTransition,
  FormatExpr,
  ConditionalExpr,
  AccessTransition,
  ActionTransition,
  LoadTransition,
} from './expressions.type'
import { PredicateTestExprBuilder } from '../builders/PredicateTestExprBuilder'
import { ConditionalExprBuilder } from '../builders/ConditionalExprBuilder'
import { ChainableExpr, ChainableRef } from '../builders/types'
import { StructureType, ExpressionType } from './enums'

/**
 * View configuration for journeys and steps.
 * Controls rendering behavior including template selection and template locals.
 */
export interface ViewConfig {
  /** Template to use for rendering (inherits from parent journey if not specified) */
  template?: string

  /** Arbitrary properties to pass to the template as locals */
  locals?: Record<string, unknown>

  /** If true, this step/journey will be marked as hidden in the navigation tree */
  hiddenFromNavigation?: boolean
}

/**
 * Base interface for all block types in the form engine.
 * Blocks are the fundamental building units of form UI.
 */
export interface BlockDefinition {
  type: StructureType.BLOCK

  /** The specific variant/type of block (e.g., 'text', 'number', 'radio', etc.) */
  variant: string

  /** Discriminator to distinguish field blocks from regular blocks */
  blockType: 'basic' | 'field'

  /** Conditional visibility - block is hidden when this evaluates to truthy */
  hidden?: boolean | PredicateExpr | PredicateTestExprBuilder

  /** Optional metadata regarding the step */
  metadata?: {
    [key: string]: any
  }
}

/**
 * Represents a validation rule for a form field.
 * Includes the validation logic, error message, and execution context.
 *
 * @example
 * // Using fluent builder syntax
 * validation({
 *   when: Answer('age').not.match(Condition.Number.IsBetween(18, 65)),
 *   message: 'Age must be between 18 and 65',
 *   details: { field: 'age', errorType: 'range' }
 * })
 *
 * @example
 * // Using object notation
 * {
 *   type: 'ExpressionType.Validation',
 *   when: {
 *     type: 'test',
 *     subject: { type: 'reference', path: ['answers', 'email'] },
 *     negate: true,
 *     condition: { type: 'function', name: 'isRequired', arguments: [] }
 *   },
 *   message: 'Email address is required',
 *   submissionOnly: false
 * }
 */
export interface ValidationExpr {
  type: ExpressionType.VALIDATION

  /** The predicate expression that determines if validation passes */
  when: PredicateExpr | PredicateTestExprBuilder

  /** Error message to display when validation fails */
  message: string

  /**
   * If true, this validation is only checked at submission time,
   * not during journey path traversal. Defaults to false.
   */
  submissionOnly?: boolean

  /**
   * Optional details that can be used by components for enhanced error handling.
   * For example, to specify which sub-field in a composite field should be highlighted.
   */
  details?: Record<string, any>
}

/**
 * Block definition for form field blocks.
 * Represents user input fields with validation and formatting.
 */
export interface FieldBlockDefinition extends BlockDefinition {
  /** Unique identifier for the field, can be conditional based on context */
  code: ConditionalString

  /** Initial or computed value for the field */
  defaultValue?: ConditionalString | ConditionalString[] | FunctionExpr<any>

  /** Array of transformers to format/process the field value */
  formatters?: TransformerFunctionExpr[]

  /** Conditional visibility - field is hidden when this evaluates to truthy */
  hidden?: boolean | PredicateExpr

  /** Array of validation errors currently active on the field */
  errors?: { message: string; details?: Record<string, any> }[]

  /** Array of validation rules to apply to the field value */
  validate?: ValidationExpr[]

  /** Marks field as dependent on other fields - used for validation ordering */
  dependent?: PredicateExpr

  /**
   * Whether to keep all values when an array is returned.
   * When false (default), only the first non-empty value is used.
   * When true, all values in the array are kept.
   */
  multiple?: boolean

  /**
   * Whether to sanitize input by escaping HTML entities.
   * When true (default), string values have < > & " ' converted to HTML entities.
   * Set to false for fields that need to accept raw HTML (e.g., rich text editors).
   * @default true
   */
  sanitize?: boolean
}

/**
 * Top-level journey definition representing a complete form flow.
 * Journeys contain steps and can have nested child journeys.
 */
export interface JourneyDefinition {
  type: StructureType.JOURNEY

  /** URL path segment for the journey */
  path: string

  /** Unique identifier for the journey */
  code: string

  /** Load foundational data when journey is accessed */
  onLoad?: LoadTransition[]

  /** Check access and run analytics when journey is accessed */
  onAccess?: AccessTransition[]

  /** Array of steps that make up the journey flow */
  steps?: StepDefinition[]

  /** Nested child journeys for hierarchical flows */
  children?: JourneyDefinition[]

  /** Display title for the journey */
  title: string

  /** Optional description of the journey's purpose */
  description?: string

  /** View configuration for rendering (template, locals) */
  view?: ViewConfig

  /**
   * Path to redirect to when journey root is accessed.
   * Takes priority over isEntryPoint, if no value, first `isEntryPoint` is used.
   */
  entryPath?: string

  /** Optional metadata regarding the journey */
  metadata?: {
    [key: string]: any
  }
}

/**
 * Definition for a single step within a journey.
 * Steps contain blocks and define navigation/transition logic.
 */
export interface StepDefinition {
  type: StructureType.STEP

  /** URL path segment for the step */
  path: string

  /** Array of blocks to render in this step */
  blocks?: BlockDefinition[]

  /** Load step-specific data when step is accessed */
  onLoad?: LoadTransition[]

  /** Check access and run analytics when step is accessed */
  onAccess?: AccessTransition[]

  /** Handle in-step actions (e.g., "Find address" button) */
  onAction?: ActionTransition[]

  /** Handle form submission transitions */
  onSubmission?: SubmitTransition[]

  /** Title for this step for displaying on the UI */
  title: string

  /** View configuration for rendering (template, locals) */
  view?: ViewConfig

  /** Marks this as an entry point step in the journey */
  isEntryPoint?: boolean

  /** Override URL for the back link (auto-calculated if not provided) */
  backlink?: string

  /** Optional metadata regarding the step */
  metadata?: {
    [key: string]: any
  }
}

export type ConditionalString =
  | string
  | ReferenceExpr
  | FormatExpr
  | PipelineExpr
  | ConditionalExpr
  | ConditionalExprBuilder
  | ChainableRef
  | ChainableExpr<any>

export type ConditionalBoolean =
  | boolean
  | ReferenceExpr
  | PipelineExpr
  | ConditionalExpr
  | ConditionalExprBuilder
  | ChainableRef
  | ChainableExpr<any>

export type ConditionalNumber =
  | number
  | ReferenceExpr
  | PipelineExpr
  | ConditionalExpr
  | ConditionalExprBuilder
  | ChainableRef
  | ChainableExpr<any>

export type ConditionalArray<T> =
  | T[]
  | ReferenceExpr
  | PipelineExpr
  | ConditionalExpr
  | ConditionalExprBuilder
  | ChainableRef
  | ChainableExpr<any>

export type RenderedBlock = {
  block: BlockDefinition
  html: string
}

export type EvaluatedBlock<T, IsRoot extends boolean = true> =
  // 1) leaf conditional types
  T extends ConditionalString
    ? string
    : T extends ConditionalBoolean
      ? boolean
      : T extends ConditionalNumber
        ? number
        : // 2) arrays (both your ConditionalArray and normal arrays)
          T extends ConditionalArray<infer U>
          ? EvaluatedBlock<U, false>[]
          : T extends (infer U)[]
            ? EvaluatedBlock<U, false>[]
            : // 3) blocks: keep shape at root; collapse nested to RenderedBlock
              T extends BlockDefinition
              ? IsRoot extends true
                ? { [K in keyof T]: K extends 'type' | 'variant' ? T[K] : EvaluatedBlock<T[K], false> } & {
                    value?: unknown
                  }
                : RenderedBlock
              : // 4) plain objects
                T extends object
                ? { [K in keyof T]: K extends 'type' | 'variant' ? T[K] : EvaluatedBlock<T[K], false> }
                : // 5) everything else
                  T
