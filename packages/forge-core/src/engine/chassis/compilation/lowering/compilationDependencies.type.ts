import type { FunctionDefinitionLookup } from '../../../../authoring/types/functions.type'

export interface CompilationDependencies {
  readonly functionRegistry: FunctionDefinitionLookup
}
