import {
  FunctionExpr,
  IterateExpr,
  PredicateExpr,
  TransformerFunctionExpr,
} from '../../authoring/types/expressions.type'
import { ChainableExpression, ChainableIterable } from '../../authoring/builders/types'
import { ComponentCallType } from '../../shared/taxonomy'
import type { ValidationExpr } from '../../authoring/types/structures.type'

/**
 * Authoring props Forge adds to every basic (non-field) component.
 * Component prop interfaces stay plain; {@link component} adds these automatically.
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
  /** Internal Forge discriminator. Do not set or override this property. */
  _forge: ComponentCallType

  /** The specific variant/type of block (e.g., 'text', 'number', 'radio', etc.) */
  variant: string
}

/**
 * Authoring props Forge adds to every field component.
 * Field component prop interfaces stay plain; {@link component} adds these automatically.
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
   * Transformers only affect submitted values, and run after component input validation.
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
export interface FieldBlockDefinition extends BlockDefinition, FieldBlockProps {
  /** Internal Forge discriminator. Do not set or override this property. */
  _forge: ComponentCallType.FIELD
}

export type ResolvableString = string | ChainableExpression

export type ResolvableBoolean = boolean | ChainableExpression | PredicateExpr

/**
 * What {@link ResolvableValueOf} passes through untouched: expression machinery
 * that is already resolvable, child blocks, and functions.
 */
type ResolvableTerminal = { readonly _forge: string } | ((...args: never[]) => unknown)

type IsAny<T> = 0 extends 1 & T ? true : false

/**
 * Widens one plain-typed value to what an author may write for it: the value
 * itself, or an expression that resolves to it. Reproduces the per-primitive
 * extras the `Resolvable*` aliases encode - booleans also accept
 * `PredicateExpr`, arrays also accept `ChainableIterable` - and recurses into
 * array elements and object properties.
 */
type ResolvableValueOf<T> =
  IsAny<T> extends true
    ? T
    : T extends ResolvableTerminal
      ? T
      : T extends boolean
        ? ResolvableBoolean
        : T extends string | number
          ? T | ChainableExpression
          : T extends readonly (infer U)[]
            ? ResolvableValueOf<U>[] | ChainableExpression
            : T extends object
              ? { [K in keyof T]: ResolvableValueOf<T[K]> } | ChainableExpression
              : T

/**
 * Derives a component's authored props from a plain-typed props interface, the
 * way function entries derive their call signature: write the props with plain
 * types once, and every prop also accepts an expression that resolves to it.
 *
 * Homomorphic, so optionality and JSDoc carry through from the plain interface.
 *
 * {@link component} applies this automatically to the plain props its
 * implementation declares.
 */
export type ResolvableProps<TProps> = {
  [K in keyof TProps]: ResolvableValueOf<TProps[K]>
}

export type RenderedBlock<TOutput = string> = {
  block: BlockDefinition
} & ([TOutput] extends [string] ? { html: string } : { output: TOutput })

/**
 * Preserves a step's block container while replacing every authored block leaf
 * with the value produced after that block has rendered.
 */
export type RenderedBlockShape<TBlockShape, TOutput = string> =
  IsAny<TBlockShape> extends true
    ? TBlockShape
    : TBlockShape extends BlockDefinition
      ? RenderedBlock<TOutput>
      : TBlockShape extends (...args: never[]) => unknown
        ? TBlockShape
        : TBlockShape extends readonly unknown[]
          ? { [TIndex in keyof TBlockShape]: RenderedBlockShape<TBlockShape[TIndex], TOutput> }
          : TBlockShape extends object
            ? { [TKey in keyof TBlockShape]: RenderedBlockShape<TBlockShape[TKey], TOutput> }
            : TBlockShape
