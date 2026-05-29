import {
  ResolvableArray,
  ResolvableBoolean,
  ResolvableString,
  FieldBlockDefinition,
  FieldBlockProps,
} from '@ministryofjustice/hmpps-forge/core/components'
import { buildNunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import { field as buildField } from '@ministryofjustice/hmpps-forge/core/authoring'
import { normaliseGovukErrorMessage, normaliseGovukTextParam } from '../../utils/govukParamNormalisers'

/**
 * Select item configuration
 */
export interface SelectItem {
  /** Value for the option. If omitted, the value is taken from the text content. */
  value?: ResolvableString
  /** Text for the option item. */
  text: ResolvableString
  /** Whether the option should be selected when the page loads. */
  selected?: ResolvableBoolean
  /** Sets the option item as disabled. */
  disabled?: ResolvableBoolean
  /** HTML attributes to add to the option. */
  attributes?: Record<string, any>
  /** Conditional visibility for this option. */
  visibleWhen?: ResolvableBoolean
}

/**
 * Props for the GovUKSelectInput component.
 * @see https://design-system.service.gov.uk/components/select/
 *
 * @example
 * ```typescript
 * GovUKSelectInput({
 *   code: 'country',
 *   label: 'Select your country',
 *   items: [
 *     { value: '', text: 'Choose an option' },
 *     { value: 'gb', text: 'United Kingdom' },
 *   ],
 * })
 * ```
 */
export interface GovUKSelectInputProps extends FieldBlockProps {
  /**
   * The ID of the select. Defaults to the value of `code` if not provided.
   * @example 'country-select'
   */
  id?: ResolvableString

  /**
   * The items within the select component.
   * Each item represents an option in the dropdown.
   *
   * @example [{ value: '', text: 'Choose an option' }, { value: 'uk', text: 'United Kingdom' }]
   */
  items: SelectItem[] | ResolvableArray<SelectItem>

  /**
   * The label used by the select component.
   * Can be a simple string or a complex object with additional properties.
   *
   * @example 'Select your country'
   * @example { text: 'Country', classes: 'govuk-label--l' }
   */
  label:
    | ResolvableString
    | {
        /** Text content of the label */
        text?: ResolvableString
        /** HTML content of the label (takes precedence over text) */
        html?: ResolvableString
        /** Additional CSS classes for the label */
        classes?: ResolvableString
        /** For attribute - automatically set if not provided */
        for?: ResolvableString
        /** Whether to render the label as a page heading (wrapped in h1) */
        isPageHeading?: ResolvableBoolean
        /** Additional HTML attributes for the label */
        attributes?: Record<string, any>
      }

  /**
   * Can be used to add a hint to the select component.
   * Provides additional context or instructions for the user.
   *
   * @example 'Select the country where you currently live'
   */
  hint?:
    | ResolvableString
    | {
        /** Text content of the hint */
        text?: ResolvableString
        /** HTML content of the hint (takes precedence over text) */
        html?: ResolvableString
        /** Additional CSS classes for the hint */
        classes?: ResolvableString
        /** Unique ID for the hint (auto-generated if not provided) */
        id?: ResolvableString
        /** Additional HTML attributes for the hint */
        attributes?: Record<string, any>
      }

  /**
   * If `true`, select box will be disabled.
   * Use the `disabled` option on each individual item to only disable certain options.
   * @example true
   */
  disabled?: ResolvableBoolean

  /**
   * One or more element IDs to add to the `aria-describedby` attribute.
   * Used to provide additional descriptive information for screenreader users.
   *
   * @example 'country-select-help'
   */
  describedBy?: ResolvableString

  /**
   * Additional options for the form group containing the select component.
   */
  formGroup?: {
    /** Classes to add to the form group wrapper. */
    classes?: ResolvableString
    /** HTML attributes to add to the form group wrapper */
    attributes?: Record<string, any>
    /** Content to add before the select element. */
    beforeInput?: {
      /** Text content to add before the select */
      text?: ResolvableString
      /** HTML content to add before the select (takes precedence over text) */
      html?: ResolvableString
    }
    /** Content to add after the select element. */
    afterInput?: {
      /** Text content to add after the select */
      text?: ResolvableString
      /** HTML content to add after the select (takes precedence over text) */
      html?: ResolvableString
    }
  }

  /**
   * Additional CSS classes to add to the select element.
   * @example 'govuk-!-width-one-half'
   */
  classes?: ResolvableString

  /**
   * Additional HTML attributes to add to the select element.
   * @example { 'data-module': 'accessible-autocomplete' }
   */
  attributes?: Record<string, any>
}

export const govukSelectInput = buildNunjucksComponent<GovUKSelectInput>('govukSelectInput', (block, nunjucksEnv) => {
  const params = {
    id: block.id ?? block.code,
    name: block.code,
    items: block.items.filter(item => item.visibleWhen !== false),
    label: normaliseGovukTextParam(block.label),
    hint: normaliseGovukTextParam(block.hint),
    value: block.value,
    disabled: block.disabled,
    describedBy: block.describedBy,
    formGroup: block.formGroup,
    classes: block.classes,
    attributes: block.attributes,
    errorMessage: normaliseGovukErrorMessage(block.errors),
  }

  return nunjucksEnv.render('govuk/components/select/template.njk', {
    params,
  })
})

/**
 * GOV.UK Select Input Component
 *
 * Full interface including forge discriminator properties.
 * For most use cases, use `GovUKSelectInputProps` type or the `GovUKSelectInput()` wrapper function instead.
 */
export interface GovUKSelectInput extends FieldBlockDefinition, GovUKSelectInputProps {
  /** Component variant identifier */
  variant: 'govukSelectInput'
}

/**
 * Creates a GOV.UK Select Input (dropdown) field.
 *
 * @see https://design-system.service.gov.uk/components/select/
 * @example
 * ```typescript
 * GovUKSelectInput({
 *   code: 'country',
 *   label: 'Select your country',
 *   items: [
 *     { value: '', text: 'Choose an option' },
 *     { value: 'gb', text: 'United Kingdom' },
 *     { value: 'fr', text: 'France' },
 *   ],
 * })
 * ```
 */
export function GovUKSelectInput(props: GovUKSelectInputProps): GovUKSelectInput {
  return buildField<GovUKSelectInput>({ ...props, variant: 'govukSelectInput' })
}
