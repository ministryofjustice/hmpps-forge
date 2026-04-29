import type ComponentRegistry from '../../registries/ComponentRegistry'
import UnregisteredComponentError from '../../errors/UnregisteredComponentError'
import { formatDSLPath } from '../formatDSLPath'
import type { BlockValidationRule } from './types'

export const createComponentRegistrationRule = (componentRegistry: ComponentRegistry): BlockValidationRule => ({
  kind: 'block',
  check: (variant, context) => {
    if (componentRegistry.has(variant)) {
      return []
    }

    return [
      new UnregisteredComponentError({
        path: [...context.path],
        formattedPath: formatDSLPath(context.root, [...context.path]),
        variant,
      }),
    ]
  },
})
