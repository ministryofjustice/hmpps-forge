import FunctionRegistry from '../../registries/FunctionRegistry'
import ComponentRegistry from '../../registries/ComponentRegistry'
import type CompilationTracer from '../tracing/CompilationTracer'

export interface CompilationDependencies {
  readonly functionRegistry: FunctionRegistry
  readonly componentRegistry: ComponentRegistry
  readonly tracer?: CompilationTracer
}
