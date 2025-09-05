export function isStringValue(obj: any): obj is string {
  return typeof obj === 'string'
}

export function isNumberValue(obj: any): obj is number {
  return typeof obj === 'number'
}

export function isBooleanValue(obj: any): obj is boolean {
  return typeof obj === 'boolean'
}

export function isNullValue(obj: any): obj is null {
  return obj === null
}

export function isObjectValue(obj: any): obj is Record<string, any> {
  return obj != null && typeof obj === 'object' && !Array.isArray(obj) && obj.constructor === Object
}

export function isArrayValue(obj: any): obj is any[] {
  return Array.isArray(obj)
}

export function isPrimitiveValue(obj: any): obj is string | number | boolean | null {
  return isStringValue(obj) || isNumberValue(obj) || isBooleanValue(obj) || isNullValue(obj)
}
