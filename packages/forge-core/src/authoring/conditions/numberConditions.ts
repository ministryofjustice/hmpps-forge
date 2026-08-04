import { z } from 'zod'
import ConditionRegistry from '../registries/ConditionRegistry'

const numberSchema = z.number()
const numberArgsSchema = z.tuple([z.number()])
const numberRangeArgsSchema = z.tuple([z.number(), z.number()])

const numberConditions = new ConditionRegistry()

export const NumberConditions = {
  /** Checks if a value is a number (not NaN, not a string, not undefined) */
  IsNumber: numberConditions.register(
    'Number.IsNumber',
    () => (value: unknown) => typeof value === 'number' && !Number.isNaN(value),
  ),

  /** Checks if a value is an integer (whole number) */
  IsInteger: numberConditions.register(
    'Number.IsInteger',
    () => (value: unknown) => typeof value === 'number' && !Number.isNaN(value) && Number.isInteger(value),
  ),

  /** Checks if a number is greater than a threshold value */
  GreaterThan: numberConditions.register(
    'Number.GreaterThan',
    {
      inputSchema: numberSchema,
      argumentsSchema: numberArgsSchema,
    },
    () => (value: number, threshold: number) => value > threshold,
  ),

  /** Checks if a number is greater than or equal to a threshold value */
  GreaterThanOrEqual: numberConditions.register(
    'Number.GreaterThanOrEqual',
    {
      inputSchema: numberSchema,
      argumentsSchema: numberArgsSchema,
    },
    () => (value: number, threshold: number) => value >= threshold,
  ),

  /** Checks if a number is less than a threshold value */
  LessThan: numberConditions.register(
    'Number.LessThan',
    {
      inputSchema: numberSchema,
      argumentsSchema: numberArgsSchema,
    },
    () => (value: number, threshold: number) => value < threshold,
  ),

  /** Checks if a number is less than or equal to a threshold value */
  LessThanOrEqual: numberConditions.register(
    'Number.LessThanOrEqual',
    {
      inputSchema: numberSchema,
      argumentsSchema: numberArgsSchema,
    },
    () => (value: number, threshold: number) => value <= threshold,
  ),

  /** Checks if a number is between two values (inclusive) */
  Between: numberConditions.register(
    'Number.Between',
    {
      inputSchema: numberSchema,
      argumentsSchema: numberRangeArgsSchema,
    },
    () => (value: number, min: number, max: number) => value >= min && value <= max,
  ),
}

export { numberConditions as numberConditionsRegistry }
