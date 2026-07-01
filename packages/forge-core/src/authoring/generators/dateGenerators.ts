import GeneratorRegistry from '../registries/GeneratorRegistry'

const dateGenerators = new GeneratorRegistry()

export const DateGenerators = {
  /** Generates the current date and time */
  Now: dateGenerators.register('Date.Now', () => () => new Date()),

  /** Generates today's date at midnight */
  Today: dateGenerators.register('Date.Today', () => () => {
    const now = new Date()

    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }),
}

export { dateGenerators as dateGeneratorsRegistry }
