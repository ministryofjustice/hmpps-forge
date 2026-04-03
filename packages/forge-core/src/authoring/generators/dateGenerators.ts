import { createFunctionsRegistry } from '../utils/createFunctionsRegistry'
import { defineGeneratorFunctions } from '../utils/defineGeneratorFunctions'

const { generators: DateGenerators, implementations } = defineGeneratorFunctions({
  /**
   * Generates the current date and time.
   *
   * @returns Current Date object with full timestamp
   *
   * @example
   * // In form definition
   * minDate: Generator.Date.Now()
   *
   * @example
   * // With pipeline
   * deadline: Generator.Date.Now().pipe(Transformer.Date.AddDays(7))
   */
  Now: () => () => new Date(),

  /**
   * Generates today's date at midnight (start of day).
   * Useful when you need a date without time component.
   *
   * @returns Date object set to start of current day (00:00:00.000)
   *
   * @example
   * // In form definition
   * defaultDate: Generator.Date.Today()
   */
  Today: () => () => {
    const now = new Date()

    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  },
})

const DateGeneratorsRegistry = createFunctionsRegistry(implementations)

export { DateGenerators, DateGeneratorsRegistry }
