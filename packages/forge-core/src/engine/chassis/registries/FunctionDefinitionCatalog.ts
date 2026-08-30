import type {
  FunctionDefinition,
  FunctionDefinitionLookup,
  FunctionDefinitionObject,
} from '../../../authoring/types/functions.type'
import ForgeRegistryDuplicateError from '../../errors/ForgeRegistryDuplicateError'
import ForgeRegistryValidationError from '../../errors/ForgeRegistryValidationError'

/** Package function metadata used during validation and compilation. */
export default class FunctionDefinitionCatalog implements FunctionDefinitionLookup {
  private readonly definitions = new Map<string, Omit<FunctionDefinition, 'factory'>>()

  register<TPackageDependencies>(input: FunctionDefinitionObject<TPackageDependencies>): void {
    const errors: Error[] = []

    Object.values(input || {}).forEach(definition => {
      if (!definition?.name) {
        errors.push(
          new ForgeRegistryValidationError({
            registryType: 'function',
            expected: 'definition with name property',
            received: definition ? 'definition without name' : 'no definition',
            message: 'Function definition must have a name property',
          }),
        )

        return
      }

      if (typeof definition.factory !== 'function') {
        errors.push(
          new ForgeRegistryValidationError({
            registryType: 'function',
            itemName: definition.name,
            expected: 'factory function',
            received: typeof definition.factory,
            message: `Function "${definition.name}" must have a factory function`,
          }),
        )

        return
      }

      if (this.definitions.has(definition.name)) {
        errors.push(
          new ForgeRegistryDuplicateError({
            registryType: 'function',
            itemName: definition.name,
          }),
        )

        return
      }

      this.definitions.set(definition.name, {
        name: definition.name,
        inputSchema: definition.inputSchema,
        argumentsSchema: definition.argumentsSchema,
        outputSchema: definition.outputSchema,
        _forge: definition._forge,
        multiple: definition.multiple,
        errorAnchor: definition.errorAnchor,
      })
    })

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Function definition registration failed')
    }
  }

  get(name: string): Omit<FunctionDefinition, 'factory'> | undefined {
    return this.definitions.get(name)
  }

  has(name: string): boolean {
    return this.definitions.has(name)
  }
}
