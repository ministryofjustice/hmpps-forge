import { createFunctionsRegistry } from '../utils/createFunctionsRegistry'
import { defineGeneratorFunctions } from '../utils/defineGeneratorFunctions'
import { GeneratorBuilder } from '../builders/GeneratorBuilder'

/**
 * Date generator functions for producing date values
 *
 * @example
 * // Standalone
 * Generator.Date.Today()
 *
 * @example
 * // With pipeline
 * Generator.Date.Now().pipe(Transformer.Date.AddDays(7))
 */
export interface DateGeneratorGroup {
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
  Now: () => GeneratorBuilder<[]>

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
  Today: () => GeneratorBuilder<[]>
}

const { generators: DateGenerators, implementations } = defineGeneratorFunctions<DateGeneratorGroup>({
  Now: () => () => new Date(),

  Today: () => () => {
    const now = new Date()

    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  },
})

const DateGeneratorsRegistry = createFunctionsRegistry(implementations)

export { DateGenerators, DateGeneratorsRegistry }
