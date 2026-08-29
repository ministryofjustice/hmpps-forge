import type { FunctionDefinitionLookup } from '../../../../authoring/types/functions.type'
import ComponentRegistry from '../../registries/ComponentRegistry'

export interface CompilationDependencies {
  readonly functionRegistry: FunctionDefinitionLookup
  readonly componentRegistry: ComponentRegistry
}
