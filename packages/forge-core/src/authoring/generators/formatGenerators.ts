import { assertString } from '../../shared/utils/asserts'
import { GeneratorBuilder } from '../builders/GeneratorBuilder'
import { ResolvableValue } from '../types/expressions.type'
import { createFunctionsRegistry } from '../utils/createFunctionsRegistry'
import { defineGeneratorFunctions } from '../utils/defineGeneratorFunctions'

export const FORMAT_STRING_GENERATOR_NAME = 'FormatString'

export interface FormatGeneratorGroup {
  FormatString: (
    template: string,
    ...replacements: ResolvableValue[]
  ) => GeneratorBuilder<[string, ...ResolvableValue[]]>
}

const { generators: FormatGenerators, implementations } = defineGeneratorFunctions<FormatGeneratorGroup>({
  FormatString: createFormatStringGenerator,
})

const FormatGeneratorsRegistry = createFunctionsRegistry(implementations)

export { FormatGenerators, FormatGeneratorsRegistry }

export function formatString(template: string, replacements: readonly unknown[]): string {
  return template.replace(/%([1-9]\d*)(?!\d)/g, (placeholder, indexValue) =>
    replaceFormatPlaceholder(placeholder, indexValue, replacements),
  )
}

function replaceFormatPlaceholder(placeholder: string, indexValue: string, replacements: readonly unknown[]): string {
  const index = Number(indexValue) - 1

  if (!Number.isInteger(index) || index < 0 || index >= replacements.length) {
    return placeholder
  }

  return String(replacements[index] ?? '')
}

function createFormatStringGenerator(): (template: unknown, ...replacements: unknown[]) => string {
  return (template, ...replacements) => {
    assertString(template, 'Generator.FormatString')

    return formatString(template, replacements)
  }
}
