import { assertString } from '../../shared/utils/asserts'
import GeneratorRegistry from '../registries/GeneratorRegistry'

export const FORMAT_STRING_GENERATOR_NAME = 'FormatString'

const formatGenerators = new GeneratorRegistry()

export const FormatGenerators = {
  FormatString: formatGenerators.register(FORMAT_STRING_GENERATOR_NAME, () => createFormatStringGenerator()),
}

export { formatGenerators as formatGeneratorsRegistry }

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
