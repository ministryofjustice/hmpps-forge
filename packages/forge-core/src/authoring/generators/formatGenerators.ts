import { z } from 'zod'
import GeneratorRegistry from '../registries/GeneratorRegistry'

export const FORMAT_STRING_GENERATOR_NAME = 'FormatString'

const formatGenerators = new GeneratorRegistry()

export const FormatGenerators = {
  /** Generates a string from a template with %1-style positional placeholders */
  FormatString: formatGenerators.register(FORMAT_STRING_GENERATOR_NAME, {
    argumentsSchema: z.tuple([z.string()], z.unknown()),
    factory:
      () =>
      (template: string, ...replacements: unknown[]) =>
        formatString(template, replacements),
  }),
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
