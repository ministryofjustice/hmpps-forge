import {
  FunctionExpr,
  PipelineExpr,
  PredicateExpr,
  PredicateTestExpr,
  ReferenceExpr,
  TransformerFunctionExpr,
  TransitionExpr,
  FormatExpr,
  ConditionalExpr,
} from './expressions.type'
import { PredicateTestExprBuilder } from '../builders/PredicateTestExprBuilder'
import { ConditionalExprBuilder } from '../builders/ConditionalExprBuilder'
import { StructureType } from './enums'

/**
 * Base interface for all block types in the form engine.
 * Blocks are the fundamental building units of form UI.
 */
export interface BlockDefinition {
  type: StructureType.BLOCK

  /** The specific variant/type of block (e.g., 'text', 'number', 'radio', etc.) */
  variant: string
}

/**
 * Configuration options for collection-based blocks.
 * Defines the data source for iterating over collections.
 */
export interface CollectionOptions {
  /** The collection source - can be a reference, pipeline, or static array */
  collection: ReferenceExpr | PipelineExpr | string[] | number[] | object[]
}

/**
 * Block definition for collection/repeater blocks.
 * Renders template blocks for each item in a collection.
 * @template T - The type of blocks used in the template
 */
export interface CollectionBlockDefinition<T = BlockDefinition> extends BlockDefinition {
  /** Template blocks to render for each collection item */
  template: readonly T[]

  /** Optional fallback block to render when collection is empty */
  fallbackTemplate?: T

  /** Configuration for the collection data source */
  collectionContext: CollectionOptions
}

/**
 * Block definition for composite blocks that contain other blocks.
 * Used for grouping and layout purposes.
 * @template B - The type of child blocks
 */
export interface CompositeBlockDefinition<B = BlockDefinition> extends BlockDefinition {
  /** Array of child blocks contained within this composite block */
  blocks: readonly B[]
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
 *   type: 'validation',
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
  type: 'validation'

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
  value?: ConditionalString | FunctionExpr<any>

  /** Array of transformers to format/process the field value */
  formatters?: readonly TransformerFunctionExpr[]

  /** Conditional visibility - field is hidden when this evaluates to truthy */
  hidden?: ConditionalBoolean

  /** Array of validation errors currently active on the field */
  errors?: readonly { message: string; details?: Record<string, any> }[]

  /** Array of validation rules to apply to the field value */
  validate?: readonly ValidationExpr[]

  /** Marks field as dependent on other fields - used for validation ordering */
  dependent?: PredicateTestExpr | PredicateTestExprBuilder
}

/**
 * Top-level journey definition representing a complete form flow.
 * Journeys contain steps and can have nested child journeys.
 */
export interface JourneyDefinition {
  type: StructureType.JOURNEY

  /** Unique identifier for the journey */
  code: string

  /** Display title for the journey */
  title: string

  /** Optional description of the journey's purpose */
  description?: string

  /** URL path segment for the journey */
  path?: string

  /** Version identifier for journey versioning */
  version?: string

  /** Optional custom Express controller applied to all steps */
  controller?: string

  /** Array of steps that make up the journey flow */
  steps?: readonly StepDefinition[]

  /** Nested child journeys for hierarchical flows */
  children?: readonly JourneyDefinition[]
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
  blocks: readonly BlockDefinition[]

  // data?: DataDefinition[] // TODO: Figure out how I'd like to do this now with transitions...

  /** Array of transition rules defining navigation from this step */
  transitions?: readonly TransitionExpr[]

  /** Optional custom Express controller for step-specific logic */
  controller?: string

  /** Optional custom Nunjucks template for rendering the step */
  template?: string

  /** Marks this as an entry point step in the journey */
  entry?: boolean

  /** Whether to validate that user can legitimately reach this step */
  checkJourneyTraversal?: boolean

  /** Override URL for the back link (auto-calculated if not provided) */
  backlink?: string
}

export type ConditionalString =
  | string
  | ReferenceExpr
  | FormatExpr
  | PipelineExpr
  | ConditionalExpr
  | ConditionalExprBuilder

export type ConditionalBoolean = boolean | ReferenceExpr | PipelineExpr | ConditionalExpr | ConditionalExprBuilder

export type ConditionalNumber = number | ReferenceExpr | PipelineExpr | ConditionalExpr | ConditionalExprBuilder

export type ConditionalArray<T> = T[] | ReferenceExpr | PipelineExpr | ConditionalExpr | ConditionalExprBuilder

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
          : T extends readonly (infer U)[]
            ? EvaluatedBlock<U, false>[]
            : // 3) blocks: keep shape at root; collapse nested to RenderedBlock
              T extends BlockDefinition
              ? IsRoot extends true
                ? { [K in keyof T]: K extends 'type' | 'variant' ? T[K] : EvaluatedBlock<T[K], false> }
                : RenderedBlock
              : // 4) plain objects
                T extends object
                ? { [K in keyof T]: K extends 'type' | 'variant' ? T[K] : EvaluatedBlock<T[K], false> }
                : // 5) everything else
                  T
