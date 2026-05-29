import { DateGenerators, DateGeneratorsRegistry } from './dateGenerators'
import { FormatGenerators, FormatGeneratorsRegistry } from './formatGenerators'

export const Generator = {
  /** Generators for producing formatted string values */
  FormatString: FormatGenerators.FormatString,

  /** Generators for producing date values */
  Date: DateGenerators,
}

export const GeneratorsRegistry = {
  ...FormatGeneratorsRegistry,
  ...DateGeneratorsRegistry,
}
