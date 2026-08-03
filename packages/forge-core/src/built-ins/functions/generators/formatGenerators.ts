import { z } from 'zod'
import GeneratorRegistry from '../../../authoring/registries/GeneratorRegistry'

export const FORMAT_STRING_GENERATOR_NAME = 'FormatString'

const formatStringArgsSchema = z.tuple([z.string()]).rest(z.unknown())

const formatGenerators = new GeneratorRegistry()

export const FormatGenerators = {
  /** Generates a string from a template with %1-style positional placeholders */
  FormatString: formatGenerators.register(
    FORMAT_STRING_GENERATOR_NAME,
    { argumentsSchema: formatStringArgsSchema },
    () =>
      (template: string, ...replacements: unknown[]) =>
        template.replace(/%([1-9]\d*)(?!\d)/g, (placeholder, indexValue) => {
          const index = Number(indexValue) - 1

          if (!Number.isInteger(index) || index < 0 || index >= replacements.length) {
            return placeholder
          }

          return String(replacements[index] ?? '')
        }),
  ),
}

export { formatGenerators as formatGeneratorsRegistry }
