import { DateGenerators, dateGeneratorsRegistry } from './dateGenerators'
import { FormatGenerators, formatGeneratorsRegistry } from './formatGenerators'

export const Generator = {
  /** Generators for producing formatted string values */
  FormatString: FormatGenerators.FormatString,

  /** Generators for producing date values */
  Date: DateGenerators,
}

export const GeneratorsRegistry = {
  ...formatGeneratorsRegistry.build(),
  ...dateGeneratorsRegistry.build(),
}
