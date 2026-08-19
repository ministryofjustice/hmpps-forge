import { z } from 'zod'
import { generator } from '../../../authoring/functions/generator'

const noArgsSchema = z.tuple([])

export const DateGenerators = {
  /** Generates the current date and time */
  Now: generator('Date.Now', {
    argumentsSchema: noArgsSchema,
    factory: () => () => new Date(),
  }),

  /** Generates today's date at midnight */
  Today: generator('Date.Today', {
    argumentsSchema: noArgsSchema,
    factory: () => () => {
      const now = new Date()

      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    },
  }),
}
