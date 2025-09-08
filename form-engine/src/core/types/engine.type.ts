import type ComponentRegistry from '@form-engine/core/registry/ComponentRegistry'
import type FunctionRegistry from '@form-engine/core/registry/FunctionRegistry'
import type Logger from 'bunyan'

export interface FormInstanceDependencies {
  componentRegistry: ComponentRegistry
  functionRegistry: FunctionRegistry
  logger: Logger | Console
}

// TODO: Use stand in for now, replace this eventually with CompiledAst instance
export type CompiledAST = object
