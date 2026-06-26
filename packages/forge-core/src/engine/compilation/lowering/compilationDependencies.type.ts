import FunctionRegistry from '../../registries/FunctionRegistry'
import ComponentRegistry from '../../registries/ComponentRegistry'

export interface CompilationDependencies {
  readonly functionRegistry: FunctionRegistry
  readonly componentRegistry: ComponentRegistry
}
