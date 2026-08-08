export function isObjectValue(obj: any): obj is Record<string, any> {
  return obj != null && typeof obj === 'object' && !Array.isArray(obj) && obj.constructor === Object
}
