import { isFieldBlockDefinition } from '../typeguards/structures'
import { ReferenceBuilder } from './ReferenceBuilder'
import { ScopedReferenceBuilder } from './ScopedReferenceBuilder'
import { LoopReferenceBuilder } from './LoopReferenceBuilder'
import { ChainableLoopRef, ChainableRef, ChainableScopedRef } from './types'
import { splitKey } from './utils/splitKey'
import { FieldBlockDefinition, ResolvableString } from '../../components/types/structures.type'

/**
 * References POST body data from form submission.
 */
export function Post(key: string): ChainableRef {
  return ReferenceBuilder.create(['post', ...splitKey(key)])
}

/**
 * References URL parameters (e.g., /users/:id).
 */
export function Params(key: string): ChainableRef {
  return ReferenceBuilder.create(['params', ...splitKey(key)])
}

/**
 * References query string parameters (e.g., ?search=test).
 */
export function Query(key: string): ChainableRef {
  return ReferenceBuilder.create(['query', ...splitKey(key)])
}

/**
 * References request metadata from the current request context.
 */
export const Request = {
  Url(): ChainableRef {
    return ReferenceBuilder.create(['request', 'url'])
  },

  Path(): ChainableRef {
    return ReferenceBuilder.create(['request', 'path'])
  },

  Method(): ChainableRef {
    return ReferenceBuilder.create(['request', 'method'])
  },

  Headers(name: string): ChainableRef {
    return ReferenceBuilder.create(['request', 'headers', name])
  },

  Cookies(name: string): ChainableRef {
    return ReferenceBuilder.create(['request', 'cookies', name])
  },

  State(key: string): ChainableRef {
    return ReferenceBuilder.create(['request', 'state', ...splitKey(key)])
  },
}

/**
 * References data defined for the step.
 */
export function Data(key: string): ChainableRef {
  return ReferenceBuilder.create(['data', ...splitKey(key)])
}

/**
 * References server-side session data from the current request context.
 */
export function Session(key: string): ChainableRef {
  return ReferenceBuilder.create(['session', ...splitKey(key)])
}

/**
 * References an answer using its target field or a string code.
 *
 * @example
 * Answer('email')  // Reference by code string
 * Answer(emailField)  // Reference by field definition
 * Answer('user.address.postcode')  // Nested path
 */
export function Answer(target: FieldBlockDefinition | ResolvableString): ChainableRef {
  // If it's a field block definition, use its code property
  if (isFieldBlockDefinition(target)) {
    const { code } = target

    // String code - split dot notation
    if (typeof code === 'string') {
      return ReferenceBuilder.create(['answers', ...splitKey(code)])
    }

    // Dynamic code (expression) - pass through
    return ReferenceBuilder.create(['answers', code as any])
  }

  // String target - split dot notation
  if (typeof target === 'string') {
    return ReferenceBuilder.create(['answers', ...splitKey(target)])
  }

  // Otherwise, use the target directly (expression types like Format)
  return ReferenceBuilder.create(['answers', target as any])
}

/**
 * References the current collection item when inside a collection scope.
 *
 * @example
 * Item().path('name')  // Access item.name
 * Item().value()  // Access the whole item
 * Item().parent.path('groupId')  // Access parent item's property
 */
export function Item(): ChainableScopedRef {
  return ScopedReferenceBuilder.create(0)
}

/**
 * References metadata for the current collection loop.
 *
 * @example
 * Loop.Index()  // 1-based iteration position
 * Loop.Index0()  // 0-based iteration index
 * Loop.Parent.Index()  // Parent loop position in nested iterations
 */
export const Loop: ChainableLoopRef = LoopReferenceBuilder.create(0)

/**
 * References the block/field it's in scope of.
 *
 * @example
 * Self().match(Condition.IsRequired())
 * Self().not.match(Condition.String.IsEmpty())
 * Self().pipe(Transformer.String.Trim).match(Condition.IsRequired())
 */
export function Self(): ChainableRef {
  return ReferenceBuilder.create(['answers', '@self'])
}
