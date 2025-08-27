import { ValueExpr } from '../types/expressions.type'

/**
 * Asserts that a value is a number (not NaN)
 */
export function assertNumber(value: ValueExpr, functionName: string): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    const valueType = Number.isNaN(value) ? 'NaN' : typeof value

    throw new Error(
      `${functionName} expects a number but received ${valueType}.
      Add Transformer.String.ToInt() or Transformer.String.ToFloat() to the field configuration.`,
    )
  }
}

/**
 * Asserts that a value is a valid Date object
 */
export function assertDate(value: ValueExpr, functionName: string): asserts value is Date {
  if (!(value instanceof Date)) {
    throw new Error(
      `${functionName} expects a Date object but received ${typeof value}.
      Add Transformer.String.ToDate() to the field configuration.`,
    )
  }

  if (Number.isNaN(value.getTime())) {
    throw new Error(
      `${functionName} received an invalid Date object.
      Ensure the date is properly parsed in your transformer.`,
    )
  }
}

/**
 * Asserts that a value is a string
 */
export function assertString(value: ValueExpr, functionName: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(
      `${functionName} expects a string but received ${typeof value}.
      Ensure the field value is a string.`,
    )
  }
}

/**
 * Asserts that a value is an array
 */
export function assertArray(value: ValueExpr, functionName: string): asserts value is any[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `${functionName} expects an array but received ${typeof value}.
      Ensure the field value is an array.`,
    )
  }
}

/**
 * Asserts that a value is an object (not null, not array, not primitive)
 */
export function assertObject(value: any, functionName: string): void {
  if (value === null || value === undefined) {
    throw new Error(
      `${functionName} expects an object but received ${value === null ? 'null' : 'undefined'}
      Ensure the field value is an object.`,
    )
  }

  if (typeof value !== 'object') {
    throw new Error(
      `${functionName} expects an object but received ${typeof value}
      Ensure the field value is an object.`,
    )
  }

  if (Array.isArray(value)) {
    throw new Error(
      `${functionName} expects an object but received array.
      Ensure the field value is an object.`,
    )
  }
}
