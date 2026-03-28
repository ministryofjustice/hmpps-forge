// Form Engine - Core
export { default as FormEngine } from '../packages/form-engine/src/core/FormEngine'
export * from '../packages/form-engine/src/form/builders'
export { coreComponents, HtmlBlock, CollectionBlock, TemplateWrapper } from '../packages/form-engine/src/registry/components'
export type { EvaluatedCollectionBlock } from '../packages/form-engine/src/registry/components'
export { Condition, ConditionsRegistry } from '../packages/form-engine/src/registry/conditions'
export { Transformer, TransformersRegistry } from '../packages/form-engine/src/registry/transformers'
export { Generator, GeneratorsRegistry } from '../packages/form-engine/src/registry/generators'

// Form Engine - Express/Nunjucks adapter
export { ExpressFrameworkAdapter, buildNunjucksComponent } from '../packages/form-engine-express-nunjucks/src/index'
export type { NunjucksComponentRenderer } from '../packages/form-engine-express-nunjucks/src/index'

// Form Engine - GOV.UK Components
export {
  govukComponents,
  govukUtilityClasses,
  GovUKButtonGroup,
  GovUKGridRow,
  GovUKSectionBreak,
  GovUKHeading,
  GovUKBody,
  GovUKList,
} from '../packages/form-engine-govuk-components/src/index'

export type {
  GovUKButtonGroupProps,
  GovUKGridRowProps,
  GovUKGridColumn,
  GovUKSectionBreakProps,
  GovUKHeadingProps,
  GovUKBodyProps,
  GovUKListProps,
  GovUKButton,
  GovUKLinkButton,
  GovUKTextInput,
  GovUKRadioInput,
  GovUKCheckboxInput,
  GovUKTextareaInput,
  GovUKCharacterCount,
  GovUKDateInputFull,
  GovUKDateInputYearMonth,
  GovUKDateInputMonthDay,
} from '../packages/form-engine-govuk-components/src/index'

// Form Engine - MOJ Components
export { mojComponents } from '../packages/form-engine-moj-components/src/index'

export type {
  MOJCard,
  MOJCardHeading,
  MOJCardDescription,
  MOJCardGroup,
  MOJCardGroupItem,
  MOJCardGroupItemHeading,
  MOJCardGroupItemDescription,
  MOJDatePicker,
  MOJDatePickerLabel,
  MOJDatePickerHint,
  MOJDatePickerFormGroup,
} from '../packages/form-engine-moj-components/src/index'
