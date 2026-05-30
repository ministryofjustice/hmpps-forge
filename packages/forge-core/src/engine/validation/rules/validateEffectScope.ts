import { FunctionType, HookType } from '../../../authoring/types/enums'
import ForgeConfigurationReferenceScopeError from '../../errors/ForgeConfigurationReferenceScopeError'
import { formatDSLPath } from '../../diagnostics/formatDSLPath'
import type { FunctionValidationRule } from './types'

const HOOK_TYPES: ReadonlySet<string> = new Set(Object.values(HookType))

export const effectScopeRule: FunctionValidationRule = {
  kind: 'function',
  check: (name, functionType, context) => {
    if (functionType !== FunctionType.EFFECT) {
      return []
    }

    if (context.ancestors.some(a => HOOK_TYPES.has(a.type))) {
      return []
    }

    return [
      new ForgeConfigurationReferenceScopeError({
        path: [...context.path],
        message: `Effect "${name}" can only be used inside a hook (onAccess or onSubmission)`,
        code: 'effect_outside_hook',
        formattedPath: formatDSLPath(context.root, [...context.path]),
      }),
    ]
  },
}
