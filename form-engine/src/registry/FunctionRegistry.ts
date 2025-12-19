import RegistryDuplicateError from '@form-engine/errors/RegistryDuplicateError'
import RegistryValidationError from '@form-engine/errors/RegistryValidationError'
import { ConditionsRegistry } from '@form-engine/registry/conditions'
import { TransformersRegistry } from '@form-engine/registry/transformers'
import { GeneratorsRegistry } from '@form-engine/registry/generators'
import { FunctionRegistryEntry, FunctionRegistryObject } from '@form-engine/registry/types/functions.type'

/**
 * Registry for managing functions (conditions, transformers, effects) in the form engine.
 * Functions are stored by their unique names and can be retrieved during form evaluation.
 */
export default class FunctionRegistry {
  private readonly functions = new Map<string, FunctionRegistryEntry>()

  /**
   * Register functions - accepts either an array of functions or a registry object
   * @param input - Array of functions or registry object from defineConditions/defineTransformers
   * @throws RegistryDuplicateError if a function with the same name already exists
   * @throws RegistryValidationError if a function has invalid structure
   * @throws AggregateError if multiple validation errors occur
   */
  register(input: FunctionRegistryObject): void {
    const errors: Error[] = []

    Object.values(input || {}).forEach(entry => {
      if (!entry.name) {
        errors.push(
          new RegistryValidationError({
            registryType: 'function',
            expected: 'object with name property',
            received: entry ? 'object without name' : 'no object',
            message: 'Function must have a name property',
          }),
        )

        return
      }

      if (!entry.evaluate || typeof entry.evaluate !== 'function') {
        errors.push(
          new RegistryValidationError({
            registryType: 'function',
            itemName: entry.name,
            expected: 'evaluate function',
            received: typeof entry.evaluate,
            message: `Function "${entry.name}" must have an evaluate function`,
          }),
        )

        return
      }

      if (this.functions.has(entry.name)) {
        errors.push(
          new RegistryDuplicateError({
            registryType: 'function',
            itemName: entry.name,
          }),
        )

        return
      }

      this.functions.set(entry.name, entry)
    })

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Function registration failed')
    }
  }

  /**
   * Register all built-in conditions, transformers, and generators
   */
  registerBuiltInFunctions() {
    this.register(ConditionsRegistry)
    this.register(TransformersRegistry)
    this.register(GeneratorsRegistry)
  }

  /**
   * Get a function by name
   * @param name - The name of the function to retrieve
   * @returns The function spec or undefined if not found
   */
  get(name: string): FunctionRegistryEntry | undefined {
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
  getAll(): Map<string, FunctionRegistryEntry> {
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
