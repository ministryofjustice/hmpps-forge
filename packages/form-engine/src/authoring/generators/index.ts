import { DateGenerators, DateGeneratorsRegistry } from './dateGenerators'

export const Generator = {
  /** Generators for producing date values */
  Date: DateGenerators,
}

export const GeneratorsRegistry = {
  ...DateGeneratorsRegistry,
}
