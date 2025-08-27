import nunjucks from 'nunjucks'
import {
  BlockDefinition,
  ConditionalBoolean,
  ConditionalString,
  EvaluatedBlock,
  FieldBlockDefinition,
} from '../../../form/types/structures.type'
import { buildComponent } from '../../../form/helpers/createComponent'

/**
 * GOV.UK Radio Input Component
 *
 * A radio button group component following the GOV.UK Design System patterns.
 * Allows users to select a single option from a list of mutually exclusive choices.
 * Provides comprehensive form validation integration, accessibility support, and
 * advanced features like conditional reveals and dividers.
 *
 * @see https://design-system.service.gov.uk/components/radios/
 */
export interface GovUKRadioInput extends FieldBlockDefinition {
  /** Component variant identifier */
  variant: 'govukRadioInput'

  /**
   * The label for the radio group.
   * When using fieldset, this becomes the legend text if no fieldset legend is specified.
   * @example 'How would you like to be contacted?'
   */
  label?: ConditionalString

  /**
   * Can be used to add a fieldset to the radios component.
   * Provides semantic grouping and accessibility benefits for multiple related inputs.
   */
  fieldset?: {
    /**
     * Legend for the fieldset - describes the group of radio options.
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
   * Can be used to add a hint to the radios component.
   * Provides additional context or instructions for the radio group.
   *
   * @example 'Select all that apply' // Simple hint
   * @example { html: 'Choose the <strong>most appropriate</strong> option' } // Rich HTML hint
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
   * Additional options for the form group containing the radios component.
   * Allows customization of the wrapper element and additional content.
   */
  formGroup?: {
    /**
     * Classes to add to the form group wrapper.
     * Useful for custom styling or indicating error states.
     */
    classes?: ConditionalString
    /** HTML attributes to add to the form group wrapper */
    attributes?: Record<string, any>
    /**
     * Content to add before all radio items within the radios component.
     * Useful for additional instructions or context.
     */
    beforeInputs?: {
      /** Text content to add before all radio items */
      text?: ConditionalString
      /** HTML content to add before all radio items (takes precedence over text) */
      html?: ConditionalString
      /** Additional CSS classes for the before inputs content */
      classes?: ConditionalString
    }
    /**
     * Content to add after all radio items within the radios component.
     * Useful for additional information or related actions.
     */
    afterInputs?: {
      /** Text content to add after all radio items */
      text?: ConditionalString
      /** HTML content to add after all radio items (takes precedence over text) */
      html?: ConditionalString
      /** Additional CSS classes for the after inputs content */
      classes?: ConditionalString
    }
  }

  /**
   * Optional prefix. This is used to prefix the `id` attribute for each radio input,
   * hint and error message, separated by `-`. Defaults to the `code` value.
   * @example 'contact-method' // Creates IDs like 'contact-method-email', 'contact-method-phone'
   */
  idPrefix?: ConditionalString

  /**
   * The value for the radio which should be checked when the page loads.
   * Use this as an alternative to setting the `checked` option on each individual item.
   * @example 'email' // Pre-selects the radio option with value 'email'
   */
  value?: ConditionalString

  /**
   * Additional CSS classes to add to the radio container.
   * @example 'govuk-radios--inline' // Display radios horizontally
   * @example 'govuk-radios--small' // Smaller radio buttons
   */
  classes?: ConditionalString

  /**
   * Additional HTML attributes (such as data attributes) to add to the radio input tag.
   * @example { 'data-module': 'govuk-radios' }
   */
  attributes?: Record<string, any>

  /**
   * The radio items within the radios component.
   * Can include both radio options and dividers for visual separation.
   * @example [
   *   { value: 'yes', text: 'Yes' },
   *   { value: 'no', text: 'No' },
   *   { divider: 'or' },
   *   { value: 'maybe', text: 'Not sure' }
   * ]
   */
  items: (GovUKRadioInputItem | GovUKRadioInputDivider)[]
}

/**
 * Individual radio option within a radio group.
 * Represents a single selectable choice with optional conditional reveals.
 */
interface GovUKRadioInputItem {
  /**
   * Value for the radio input. This is submitted with the form data when selected.
   * @example 'email'
   * @example 'phone'
   */
  value: ConditionalString

  /**
   * Text to use within the radio item label.
   * If `html` is provided, this will be ignored.
   * @example 'Email'
   */
  text?: ConditionalString

  /**
   * HTML to use within the radio item label.
   * Takes precedence over `text` if both are provided.
   * @example 'Email <span class="govuk-caption-m">Fastest response</span>'
   */
  html?: ConditionalString

  /**
   * Specific ID attribute for the radio item.
   * If omitted, then `idPrefix` string will be applied with the value.
   * @example 'contact-email'
   */
  id?: ConditionalString

  /**
   * Can be used to add a hint to each radio item within the radios component.
   * Provides additional context for individual options.
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
   * Whether the radio should be checked when the page loads.
   * Takes precedence over the top-level `value` option.
   * @example true // Pre-select this option
   */
  checked?: ConditionalBoolean

  /**
   * If `true`, radio will be disabled and cannot be selected.
   * @example true // Disable this option
   */
  disabled?: ConditionalBoolean

  /**
   * Additional HTML attributes (such as data attributes) to add to the radio input tag.
   * @example { 'data-aria-controls': 'conditional-content' }
   */
  attributes?: Record<string, any>

  /**
   * Provide additional content to reveal when the radio is checked.
   * Useful for collecting additional information when specific options are selected.
   * @example someConditionalField // A field definition that appears when this radio is selected
   */
  block?: BlockDefinition
}

/**
 * Divider element to separate radio options visually.
 * Useful for grouping related options or providing "or" separators.
 */
interface GovUKRadioInputDivider {
  /**
   * Divider text to separate radio items.
   * @example 'or'
   * @example 'Alternative options'
   */
  divider: ConditionalString
}

export const govukRadioInput = buildComponent<GovUKRadioInput>('govukRadioInput', async block => {
  const items = block.items.map(option => makeOption(option, block.value))

  const params = {
    fieldset: block.fieldset || {
      legend: {
        text: block.label,
      },
    },
    idPrefix: block.idPrefix || block.code,
    name: block.code,
    value: block.value,
    formGroup: block.formGroup,
    hint: typeof block.hint === 'object' ? block.hint : { text: block.hint },
    items,
    classes: block.classes,
    attributes: block.attributes,
    errorMessage: block.errors?.length && { text: block.errors[0].message },
  }

  return nunjucks.render('govuk/components/radios/template.njk', {
    params,
  })
})

const makeOption = (option: EvaluatedBlock<GovUKRadioInputItem | GovUKRadioInputDivider>, checkedValue: string) => {
  if (isRadioDivider(option)) {
    return {
      divider: option.divider,
    }
  }

  return {
    value: option.value,
    text: option.text,
    html: option.html,
    id: option.id,
    hint: typeof option.hint === 'object' ? option.hint : { text: option.hint },
    checked: checkedValue === option.value || (option.checked ?? false),
    conditional: option.block && {
      html: option.block.html,
    },
    disabled: option.disabled,
    attributes: option.attributes,
  }
}

// Narrow to Divider
function isRadioDivider(
  option: EvaluatedBlock<GovUKRadioInputItem | GovUKRadioInputDivider>,
): option is EvaluatedBlock<GovUKRadioInputDivider>
function isRadioDivider(option: any): option is GovUKRadioInputDivider {
  return option != null && typeof option === 'object' && 'divider' in option && !('value' in option) // prefer Divider if both accidentally exist
}
