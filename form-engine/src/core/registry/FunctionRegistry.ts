import { FunctionEvaluator, RegistryFunction } from '@form-engine/registry/utils/createRegisterableFunction'
import RegistryDuplicateError from '@form-engine/errors/RegistryDuplicateError'
import RegistryValidationError from '@form-engine/errors/RegistryValidationError'
import { Condition } from '@form-engine/registry/conditions'
import { Transformer } from '@form-engine/registry/transformers'

/**
 * Registry for managing functions (conditions, transformers, effects) in the form engine.
 * Functions are stored by their unique names and can be retrieved during form evaluation.
 */
export default class FunctionRegistry {
  private readonly functions = new Map<
    string,
    {
      name: string
      evaluate: FunctionEvaluator<any>
    }
  >()

  /**
   * Register multiple functions at once
   *
   * @param functions - Array of registry functions to register
   * @throws RegistryDuplicateError if a function with the same name already exists
   * @throws RegistryValidationError if a function has invalid spec
   * @throws AggregateError if multiple validation errors occur
   */
  registerMany(functions: RegistryFunction<any>[]): void {
    if (!functions || functions.length === 0) {
      return
    }

    const errors: Error[] = []

    for (const func of functions) {
      if (!func?.spec?.name) {
        errors.push(
          new RegistryValidationError({
            registryType: 'function',
            expected: 'spec with name property',
            received: func?.spec ? 'spec without name' : 'no spec',
            message: 'Function must have a spec with a name property',
          }),
        )
      } else if (!func.spec.evaluate || typeof func.spec.evaluate !== 'function') {
        errors.push(
          new RegistryValidationError({
            registryType: 'function',
            itemName: func.spec.name,
            expected: 'spec with evaluate function',
            received: typeof func.spec.evaluate,
            message: `Function "${func.spec.name}" must have a spec with an evaluate function`,
          }),
        )
      } else if (this.functions.has(func.spec.name)) {
        errors.push(
          new RegistryDuplicateError({
            registryType: 'function',
            itemName: func.spec.name,
          }),
        )
      } else {
        this.functions.set(func.spec.name, func.spec)
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Function registration failed')
    }
  }

  /**
   * Register all built-in conditions and transformers
   */
  registerBuiltInFunctions() {
    this.registerMany([
      // General conditions (direct since they're at root level)
      Condition.Equals,
      Condition.IsRequired,

      // Specific condition categories
      ...Object.values(Condition.Array),
      ...Object.values(Condition.Number),
      ...Object.values(Condition.String),
      ...Object.values(Condition.Date),
      ...Object.values(Condition.Email),
      ...Object.values(Condition.Phone),
      ...Object.values(Condition.Address),

      // All transformers
      ...Object.values(Transformer.String),
      ...Object.values(Transformer.Number),
      ...Object.values(Transformer.Array),
      ...Object.values(Transformer.Object),
    ])
  }

  /**
   * Get a function by name
   * @param name - The name of the function to retrieve
   * @returns The function spec or undefined if not found
   */
  get(name: string): { name: string; evaluate: (...args: any[]) => any } | undefined {
    return this.functions.get(name)
  }

  /**
   * Check if a function is registered
   * @param name - The name of the function to check
   * @returns True if the function exists, false otherwise
   */
  has(name: string): boolean {
    return this.functions.has(name)
  }

  /**
   * Get all registered functions
   * @returns Map of all registered functions
   */
  getAll(): Map<string, { name: string; evaluate: (...args: any[]) => any }> {
    return new Map(this.functions)
  }

  /**
   * Get the count of registered functions
   * @returns Number of registered functions
   */
  size(): number {
    return this.functions.size
  }
}
