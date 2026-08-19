import ForgeRegistryDuplicateError from '../../errors/ForgeRegistryDuplicateError'
import ForgeRegistryValidationError from '../../errors/ForgeRegistryValidationError'
import { FunctionRegistryEntry, FunctionRegistryObject } from '../../../authoring/types/functions.type'

/**
 * Registry for managing functions (conditions, transformers, effects) in forge.
 * Functions are stored by their unique names and can be retrieved during form evaluation.
 */
export default class FunctionRegistry {
  private readonly functions = new Map<string, FunctionRegistryEntry>()

  /**
   * Register functions - accepts either an array of functions or a registry object
   * @param input - Registry object created by the authoring function helpers
   * @throws ForgeRegistryDuplicateError if a function with the same name already exists
   * @throws ForgeRegistryValidationError if a function has invalid structure
   * @throws AggregateError if multiple validation errors occur
   */
  register(input: FunctionRegistryObject): void {
    const errors: Error[] = []

    Object.values(input || {}).forEach(entry => {
      if (!entry.name) {
        errors.push(
          new ForgeRegistryValidationError({
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
          new ForgeRegistryValidationError({
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
          new ForgeRegistryDuplicateError({
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
