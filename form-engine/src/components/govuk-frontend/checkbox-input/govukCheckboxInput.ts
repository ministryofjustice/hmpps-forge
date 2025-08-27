import nunjucks from 'nunjucks'
import {
  BlockDefinition,
  ConditionalBoolean,
  ConditionalString,
  EvaluatedBlock,
  FieldBlockDefinition,
} from '../../../form/types/structures.type'
import { buildComponent } from '../../../form/helpers/createComponent'
import { FunctionExpr } from '../../../form/types/expressions.type'

/**
 * GOV.UK Checkbox Input Component
 *
 * A checkbox group component following the GOV.UK Design System patterns.
 * Allows users to select multiple options from a list of choices.
 * Provides comprehensive form validation integration, accessibility support, and
 * advanced features like conditional reveals, dividers, and exclusive behaviors.
 *
 * @see https://design-system.service.gov.uk/components/checkboxes/
 */
export interface GovUKCheckboxInput extends FieldBlockDefinition {
  /** Component variant identifier */
  variant: 'govukCheckboxInput'

  /**
   * The label for the checkbox group.
   * When using fieldset, this becomes the legend text if no fieldset legend is specified.
   *
   * @example 'Which countries have you visited?'
   */
  label?: ConditionalString

  /**
   * Array of values for checkboxes which should be checked when the page loads.
   * Use this as an alternative to setting the `checked` option on each individual item.
   *
   * @example ['email', 'phone'] // Pre-selects checkboxes with these values
   */
  value?: ConditionalString[] | FunctionExpr<any>

  /** Can be used to add a fieldset to the checkboxes component. */
  fieldset?: {
    /**
     * Legend for the fieldset - describes the group of checkbox options.
     * If not provided, falls back to the `label` property.
     */
    legend?: {
      /** Text content of the legend */
      text?: ConditionalString

      /** HTML content of the legend (takes precedence over text) */
      html?: ConditionalString

      /** Additional CSS classes for the legend */
      classes?: ConditionalString

      /** Whether to render the legend as a page heading (wrapped in h1) */
      isPageHeading?: ConditionalBoolean
    }

    /** Additional CSS classes for the fieldset wrapper */
    classes?: ConditionalString

    /** HTML attributes to add to the fieldset */
    attributes?: Record<string, any>

    /** Element IDs to add to the fieldset's aria-describedby attribute */
    describedBy?: ConditionalString
  }

  /**
   * Can be used to add a hint to the checkboxes component.
   * Provides additional context or instructions for the checkbox group.
   *
   * @example 'Select all that apply' // Simple hint
   * @example { html: 'Choose <strong>all relevant</strong> options' } // Rich HTML hint
   */
  hint?:
    | ConditionalString
    | {
        /** Unique ID for the hint (auto-generated if not provided) */
        id?: ConditionalString

        /** Text content of the hint */
        text?: ConditionalString

        /** HTML content of the hint (takes precedence over text) */
        html?: ConditionalString

        /** Additional CSS classes for the hint */
        classes?: ConditionalString

        /** Additional HTML attributes for the hint */
        attributes?: Record<string, any>
      }

  /** Additional options for the form group containing the checkboxes component. */
  formGroup?: {
    /** Classes to add to the form group wrapper. */
    classes?: ConditionalString

    /** HTML attributes to add to the form group wrapper */
    attributes?: Record<string, any>

    /** Content to add before all checkbox items within the checkboxes component. */
    beforeInputs?: {
      /** Text content to add before all checkbox items */
      text?: ConditionalString
      /** HTML content to add before all checkbox items (takes precedence over text) */
      html?: ConditionalString
      /** Additional CSS classes for the before inputs content */
      classes?: ConditionalString
    }

    /** Content to add after all checkbox items within the checkboxes component. */
    afterInputs?: {
      /** Text content to add after all checkbox items */
      text?: ConditionalString

      /** HTML content to add after all checkbox items (takes precedence over text) */
      html?: ConditionalString

      /** Additional CSS classes for the after inputs content */
      classes?: ConditionalString
    }
  }

  /**
   * Optional prefix. This is used to prefix the `id` attribute for each checkbox item input,
   * hint and error message, separated by `-`. Defaults to the `code` value.
   *
   * @example 'contact-methods' // Creates IDs like 'contact-methods-email', 'contact-methods-phone'
   */
  idPrefix?: ConditionalString

  /**
   * Name attribute for all checkbox items.
   *
   * @example 'contact_preferences' // Form submission key
   */
  name?: ConditionalString

  /**
   * Additional CSS classes to add to the checkboxes container.
   *
   * @example 'govuk-checkboxes--small' // Smaller checkboxes
   */
  classes?: ConditionalString

  /** Additional HTML attributes (such as data attributes) to add to the anchor tag. */
  attributes?: Record<string, any>

  /**
   * The checkbox items within the checkboxes component.
   * Can include both checkbox options and dividers for visual separation.
   *
   * @example [
   *   { value: 'email', text: 'Email' },
   *   { value: 'phone', text: 'Phone' },
   *   { divider: 'or' },
   *   { value: 'none', text: 'None of the above', behaviour: 'exclusive' }
   * ]
   */
  items: (GovUKCheckboxInputItem | GovUKCheckboxInputDivider)[]
}

/**
 * Individual checkbox option within a checkbox group.
 * Represents a single selectable choice with optional conditional reveals and behaviors.
 */
interface GovUKCheckboxInputItem {
  /**
   * Value for the checkbox input. This is submitted with the form data when selected.
   *
   * @example 'Dog'
   */
  value: ConditionalString

  /**
   * Text to use within the checkbox item label.
   * If `html` is provided, this will be ignored.
   *
   * @example 'Email'
   */
  text?: ConditionalString

  /**
   * HTML to use within the checkbox item label.
   * Takes precedence over `text` if both are provided.
   *
   * @example 'Email <span class="govuk-caption-m">Fastest response</span>'
   */
  html?: ConditionalString

  /**
   * Specific ID attribute for the checkbox item.
   * If omitted, then component global `idPrefix` option will be applied.
   *
   * @example 'contact-email'
   */
  id?: ConditionalString

  /**
   * Can be used to add a hint to each checkbox item within the checkboxes component.
   * Provides additional context for individual options.
   *
   * @example 'We'll send updates to this email address'
   */
  hint?:
    | ConditionalString
    | {
        /** Unique ID for the hint (auto-generated if not provided) */
        id?: ConditionalString

        /** Text content of the hint */
        text?: ConditionalString

        /** HTML content of the hint (takes precedence over text) */
        html?: ConditionalString

        /** Additional CSS classes for the hint */
        classes?: ConditionalString

        /** Additional HTML attributes for the hint */
        attributes?: Record<string, any>
      }

  /**
   * Whether the checkbox should be checked when the page loads.
   * Takes precedence over the top-level `values` option.
   *
   * @example true // Pre-select this option
   */
  checked?: ConditionalBoolean

  /**
   * If `true`, checkbox will be disabled and cannot be selected.
   *
   * @example true // Disable this option
   */
  disabled?: ConditionalBoolean

  /**
   * If set to "exclusive", implements a 'None of these' type behavior via JavaScript.
   * When this checkbox is selected, all other checkboxes in the group are unchecked.
   * When any other checkbox is selected, this exclusive checkbox is unchecked.
   *
   * @example 'exclusive' // Typical for "None of the above" options
   */
  behaviour?: 'exclusive'

  /**
   * Additional HTML attributes (such as data attributes) to add to the checkbox input tag.
   */
  attributes?: Record<string, any>

  /**
   * Subset of options for the label used by each checkbox item.
   */
  label?: {
    /** Additional CSS classes for the label tag */
    classes?: ConditionalString

    /** HTML attributes to add to the label tag */
    attributes?: Record<string, any>
  }

  /**
   * Provide additional content to reveal when the checkbox is checked.
   * Useful for collecting additional information when specific options are selected.
   *
   * @example someConditionalField // A field definition that appears when this checkbox is selected
   */
  block?: BlockDefinition
}

/**
 * Divider element to separate checkbox options visually.
 */
interface GovUKCheckboxInputDivider {
  /**
   * Divider text to separate checkbox items.
   *
   * @example 'or'
   */
  divider: ConditionalString
}

export const govukCheckboxInput = buildComponent<GovUKCheckboxInput>('govukCheckboxInput', async block => {
  const items = block.items.map(option => makeOption(option, block.value))

  const params = {
    fieldset: block.fieldset || {
      legend: {
        text: block.label,
      },
    },
    idPrefix: block.idPrefix || block.code,
    name: block.name || block.code,
    formGroup: block.formGroup,
    hint: typeof block.hint === 'object' ? block.hint : { text: block.hint },
    items,
    classes: block.classes,
    attributes: block.attributes,
    errorMessage: block.errors?.length && { text: block.errors[0].message },
  }

  return nunjucks.render('govuk/components/checkboxes/template.njk', {
    params,
  })
})

const makeOption = (option: EvaluatedBlock<GovUKCheckboxInputItem | GovUKCheckboxInputDivider>, blockValue?: any) => {
  if (isCheckboxDivider(option)) {
    return {
      divider: option.divider,
    }
  }

  // For checkboxes, check if the option value is in the array of values
  let isChecked: boolean
  if (option.checked !== undefined) {
    isChecked = Boolean(option.checked)
  } else if (Array.isArray(blockValue)) {
    isChecked = blockValue.includes(option.value)
  }

  return {
    value: option.value,
    text: option.text,
    html: option.html,
    id: option.id,
    hint: typeof option.hint === 'object' ? option.hint : { text: option.hint },
    checked: isChecked,
    conditional: option.block,
    disabled: option.disabled,
    behaviour: option.behaviour,
    attributes: option.attributes,
    label: option.label,
  }
}

// Narrow to Divider
function isCheckboxDivider(
  option: EvaluatedBlock<GovUKCheckboxInputItem | GovUKCheckboxInputDivider>,
): option is EvaluatedBlock<GovUKCheckboxInputDivider>
function isCheckboxDivider(option: any): option is GovUKCheckboxInputDivider {
  return option != null && typeof option === 'object' && 'divider' in option && !('value' in option) // prefer Divider if both accidentally exist
}
