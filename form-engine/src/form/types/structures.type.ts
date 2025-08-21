import { ConditionalString, ConditionalValue } from './values.type'
import {
  ConditionalExpr,
  FunctionExpr,
  PipelineExpr,
  ReferenceExpr,
  TransformerExpr,
  TransitionExpr,
} from './expressions.type'
import { ConditionalExprBuilder } from '../builders/ConditionalExprBuilder'

/**
 * Base interface for all block types in the form engine.
 * Blocks are the fundamental building units of form UI.
 */
export interface BlockDefinition {
  type: 'block'

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
  template: T[]

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
  blocks: B[]
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
  formatters?: TransformerExpr[]

  /** Conditional visibility - field is hidden when this evaluates to truthy */
  hidden?: ConditionalValue<any>

  /** Array of validation error messages currently active on the field */
  errors?: string[]

  /** Array of validation rules to apply to the field value */
  validate?: (ConditionalExpr | ConditionalExprBuilder)[]

  /** Marks field as dependent on other fields - used for validation ordering */
  dependent?: ConditionalExpr | ConditionalExprBuilder
}

/**
 * Top-level journey definition representing a complete form flow.
 * Journeys contain steps and can have nested child journeys.
 */
export interface JourneyDefinition {
  type: 'journey'

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
  steps?: StepDefinition[]

  /** Nested child journeys for hierarchical flows */
  children?: JourneyDefinition[]
}

/**
 * Definition for a single step within a journey.
 * Steps contain blocks and define navigation/transition logic.
 */
export interface StepDefinition {
  type: 'step'

  /** URL path segment for the step */
  path: string

  /** Array of blocks to render in this step */
  blocks: BlockDefinition[]

  // data?: DataDefinition[] // TODO: Figure out how I'd like to do this now with transitions...

  /** Array of transition rules defining navigation from this step */
  transitions?: TransitionExpr[]

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
