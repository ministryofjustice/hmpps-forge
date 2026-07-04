/**
 * Asserts that a value is a number (not NaN)
 */
export function assertNumber(value: unknown, functionName: string): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    const valueType = Number.isNaN(value) ? 'NaN' : typeof value

    throw new TypeError(
      `${functionName} expects a number but received ${valueType}.
      Add Transformer.String.ToInt() or Transformer.String.ToFloat() to the field configuration.`,
    )
  }
}

/**
 * Asserts that a value is a valid Date object
 */
export function assertDate(value: unknown, functionName: string): asserts value is Date {
  if (!(value instanceof Date)) {
    throw new TypeError(
      `${functionName} expects a Date object but received ${typeof value}.
      Add Transformer.String.ToDate() to the field configuration.`,
    )
  }

  if (Number.isNaN(value.getTime())) {
    throw new TypeError(
      `${functionName} received an invalid Date object.
      Ensure the date is properly parsed in your transformer.`,
    )
  }
}

/**
 * Asserts that a value is a string
 */
export function assertString(value: unknown, functionName: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(
      `${functionName} expects a string but received ${typeof value}.
      Ensure the field value is a string.`,
    )
  }
}

/**
 * Asserts that a value is an array
 */
export function assertArray(value: unknown, functionName: string): asserts value is any[] {
  if (!Array.isArray(value)) {
    throw new TypeError(
      `${functionName} expects an array but received ${typeof value}.
      Ensure the field value is an array.`,
    )
  }
}

/**
 * Asserts that a value is JSON-serializable (no functions, Symbols, BigInts, Dates, or class instances).
 * Recursively checks nested objects and arrays.
 */
export function assertSerializable(value: unknown, method: string, path: string[] = []): void {
  if (typeof value === 'function') {
    throw new TypeError(`${method}: Cannot set a function as a value (at ${formatAssertPath(path)})`)
  }

  if (typeof value === 'symbol') {
    throw new TypeError(`${method}: Cannot set a Symbol as a value (at ${formatAssertPath(path)})`)
  }

  if (typeof value === 'bigint') {
    throw new TypeError(`${method}: Cannot set a BigInt as a value (at ${formatAssertPath(path)})`)
  }

  if (value instanceof Date) {
    throw new TypeError(
      `${method}: Cannot set a Date object as a value — use an ISO string instead (at ${formatAssertPath(path)})`,
    )
  }

  if (value !== null && typeof value === 'object') {
    if (!Array.isArray(value) && value.constructor !== Object) {
      throw new TypeError(
        `${method}: Cannot set a ${value.constructor.name} instance as a value — use a plain object instead (at ${formatAssertPath(path)})`,
      )
    }

    if (Array.isArray(value)) {
      value.forEach((item, i) => assertSerializable(item, method, [...path, String(i)]))
    } else {
      Object.entries(value).forEach(([key, v]) => assertSerializable(v, method, [...path, key]))
    }
  }
}

function formatAssertPath(path: string[]): string {
  return path.length > 0 ? path.join('.') : 'root'
}

/**
 * Asserts that a value is an object (not null, not array, not primitive)
 */
export function assertObject(value: unknown, functionName: string): void {
  if (value === null || value === undefined) {
    throw new TypeError(
      `${functionName} expects an object but received ${value === null ? 'null' : 'undefined'}
      Ensure the field value is an object.`,
    )
  }

  if (typeof value !== 'object') {
    throw new TypeError(
      `${functionName} expects an object but received ${typeof value}
      Ensure the field value is an object.`,
    )
  }

  if (Array.isArray(value)) {
    throw new TypeError(
      `${functionName} expects an object but received array.
      Ensure the field value is an object.`,
    )
  }
}
