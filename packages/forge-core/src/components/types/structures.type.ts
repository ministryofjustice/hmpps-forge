import {
  FunctionExpr,
  IterateExpr,
  PredicateExpr,
  TransformerFunctionExpr,
} from '../../authoring/types/expressions.type'
import {
  ChainableConditional,
  ChainableExpr,
  ChainableGenerator,
  ChainableIterable,
  ChainableMatch,
  ChainableRef,
} from '../../authoring/builders/types'
import { BlockType, StructureType } from '../../authoring/types/enums'
import type { ValidationExpr } from '../../authoring/types/structures.type'

/**
 * Props for basic (non-field) block components.
 * Use this as the base for component Props interfaces.
 */
export interface BasicBlockProps {
  /**
   * Conditional visibility - the block is rendered when this evaluates to truthy.
   * Defaults to true (always visible).
   *
   * To also skip validation and clear the value, use `dependentWhen` on field blocks.
   *
   * @example false // Always hidden
   * @example Answer('contactMethod').match(Condition.Equals('email')) // Visible when email selected
   */
  visibleWhen?: ResolvableBoolean

  /**
   * Optional metadata for the field.
   * Can be used for analytics, debugging, or custom processing.
   *
   * @example { section: 'personal-details', priority: 'high' }
   */
  metadata?: {
    [key: string]: any
  }
}

/**
 * Base interface for all block types in forge.
 * Blocks are the fundamental building units of form UI.
 */
export interface BlockDefinition extends BasicBlockProps {
  type: StructureType.BLOCK

  /** The specific variant/type of block (e.g., 'text', 'number', 'radio', etc.) */
  variant: string

  /** Discriminator to distinguish field blocks from regular blocks */
  blockType: BlockType
}

/**
 * Props for field block components.
 * Use this as the base for field component Props interfaces.
 */
export interface FieldBlockProps extends BasicBlockProps {
  /**
   * Unique identifier for the field within the form.
   * Used for storing answers and referencing the field value.
   *
   * @example 'email'
   * @example 'date_of_birth'
   * @example Format('task_%1_status', Item().path('id')) // Dynamic code in iterators
   */
  code: ResolvableString

  /**
   * Initial or computed value for the field.
   * Can be a static value, a reference to another field, or a computed expression.
   *
   * @example 'United Kingdom' // Static default
   * @example Answer('previousEmail') // Copy from another field
   * @example Data('user.name') // From loaded data
   */
  defaultValue?: ResolvableString | ResolvableString[] | FunctionExpr<any>

  /**
   * Array of transformers to format/process the field value before rendering/storing.
   * Transformers only affect submitted values, and run AFTER sanitization.
   *
   * @example [Transformer.String.Trim()] // Remove whitespace
   * @example [Transformer.String.Uppercase(), Transformer.String.SnakeCase()] // Convert to uppercase snake_case
   */
  formatters?: TransformerFunctionExpr[]

  /**
   * Array of parsers to transform stored values back to display form on GET.
   * Parsers are the inverse of formatters: they run when loading a stored value
   * for rendering, converting canonical form back to what the component needs.
   * Parsers do NOT modify the stored answer.
   */
  parsers?: TransformerFunctionExpr[]

  /**
   * Array of validation rules for this field.
   * The field is valid when all conditions pass.
   *
   * @example
   * validWhen: [
   *   validation({
   *     condition: Self().match(Condition.IsRequired()),
   *     message: 'Enter your full name',
   *   }),
   *   validation({
   *     condition: Self().match(Condition.String.HasMaxLength(200)),
   *     message: 'Full name must be 200 characters or less',
   *   }),
   * ]
   */
  validWhen?: (ValidationExpr | IterateExpr | ChainableIterable)[] | IterateExpr | ChainableIterable

  /**
   * Marks field as dependent on other fields.
   * When the predicate evaluates to false, validation is skipped and the answer is cleared.
   *
   * **Note:** This does not affect rendering — the field is still visible.
   * To also control visibility, use `visibleWhen`.
   *
   * @example
   * // Only validate and keep this field's value when appointmentType is 'phone'
   * dependentWhen: Answer('appointmentType').match(Condition.Equals('phone'))
   */
  dependentWhen?: PredicateExpr
}

/**
 * Block definition for form field blocks.
 * Represents user input fields with validation and formatting.
 */
export interface FieldBlockDefinition extends BlockDefinition, FieldBlockProps {}

/**
 * The fluent wrappers the authoring DSL returns.
 * Authors only ever see this side; the finalisation walk unwraps these into the
 * wire-format expressions (ReferenceExpr, PipelineExpr, ...) the engine consumes.
 */
type ChainableValue = ChainableRef | ChainableExpr | ChainableConditional | ChainableMatch | ChainableGenerator

export type ResolvableString = string | ChainableValue

export type ResolvableBoolean = boolean | ChainableValue | PredicateExpr

export type ResolvableNumber = number | ChainableValue

export type ResolvableArray<T> = T[] | ChainableValue | ChainableIterable

export type ResolvableObject<T extends object> = T | ChainableValue

export type RenderedBlock<TOutput = string> = {
  block: BlockDefinition
} & ([TOutput] extends [string] ? { html: string } : { output: TOutput })

type Resolved<T> = Exclude<T, ChainableValue | ChainableIterable | IterateExpr | PredicateExpr>

export type EvaluatedBlock<T, IsRoot extends boolean = true, TRenderedBlock = RenderedBlock> =
  Resolved<T> extends infer R
    ? [R] extends [never]
      ? never
      : R extends string
        ? string
        : R extends boolean
          ? boolean
          : R extends number
            ? number
            : R extends (infer U)[]
              ? EvaluatedBlock<U, false, TRenderedBlock>[]
              : R extends FieldBlockDefinition
                ? IsRoot extends true
                  ? {
                      [K in keyof R]: K extends 'type' | 'variant' ? R[K] : EvaluatedBlock<R[K], false, TRenderedBlock>
                    } & {
                      value?: unknown
                      errors?: { message: string; details?: Record<string, any> }[]
                    }
                  : TRenderedBlock
                : R extends BlockDefinition
                  ? IsRoot extends true
                    ? {
                        [K in keyof R]: K extends 'type' | 'variant'
                          ? R[K]
                          : EvaluatedBlock<R[K], false, TRenderedBlock>
                      } & {
                        value?: unknown
                      }
                    : TRenderedBlock
                  : R extends object
                    ? {
                        [K in keyof R]: K extends 'type' | 'variant'
                          ? R[K]
                          : EvaluatedBlock<R[K], false, TRenderedBlock>
                      }
                    : R
    : never
