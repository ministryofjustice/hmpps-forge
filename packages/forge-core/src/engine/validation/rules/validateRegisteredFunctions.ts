import type FunctionRegistry from '../../registries/FunctionRegistry'
import UnregisteredFunctionError from '../../errors/UnregisteredFunctionError'
import { formatDSLPath } from '../formatDSLPath'
import type { FunctionValidationRule } from './types'

export const createFunctionRegistrationRule = (functionRegistry: FunctionRegistry): FunctionValidationRule => ({
  kind: 'function',
  check: (name, functionType, context) => {
    if (functionRegistry.has(name)) {
      return []
    }

    return [
      new UnregisteredFunctionError({
        path: [...context.path],
        formattedPath: formatDSLPath(context.root, [...context.path]),
        functionName: name,
        functionType,
      }),
    ]
  },
})
