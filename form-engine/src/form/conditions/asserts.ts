import { ValueExpr } from '../types/expressions.type'

export function assertNumber(value: ValueExpr, conditionName: string): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    const valueType = Number.isNaN(value) ? 'NaN' : typeof value

    throw new Error(
      `${conditionName} expects a number but received ${valueType}.
      Add Transformer.String.ToInt() or Transformer.String.ToFloat() to the field configuration.`,
    )
  }
}

export function assertDate(value: ValueExpr, conditionName: string): asserts value is Date {
  if (!(value instanceof Date)) {
    throw new Error(
      `${conditionName} expects a Date object but received ${typeof value}.
      Add Transformer.String.ToDate() to the field configuration.`,
    )
  }

  if (Number.isNaN(value.getTime())) {
    throw new Error(
      `${conditionName} received an invalid Date object.
      Ensure the date is properly parsed in your transformer.`,
    )
  }
}

export function assertString(value: ValueExpr, conditionName: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(
      `${conditionName} expects a string but received ${typeof value}.
      Ensure the field value is a string.`,
    )
  }
}

export function assertArray(value: ValueExpr, conditionName: string): asserts value is any[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `${conditionName} expects an array but received ${typeof value}.
      Ensure the field value is an array.`,
    )
  }
}
