import { z } from 'zod'
import GeneratorRegistry from '../registries/GeneratorRegistry'

const noArgsSchema = z.tuple([])

const dateGenerators = new GeneratorRegistry()

export const DateGenerators = {
  /** Generates the current date and time */
  Now: dateGenerators.register('Date.Now', {
    argumentsSchema: noArgsSchema,
    factory: () => () => new Date(),
  }),

  /** Generates today's date at midnight */
  Today: dateGenerators.register('Date.Today', {
    argumentsSchema: noArgsSchema,
    factory: () => () => {
      const now = new Date()

      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    },
  }),
}

export { dateGenerators as dateGeneratorsRegistry }
