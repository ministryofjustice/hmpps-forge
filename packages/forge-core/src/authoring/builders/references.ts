import { isFieldBlockDefinition } from '../../components/typeguards'
import { ReferenceBuilder } from './ReferenceBuilder'
import { ScopedReferenceBuilder } from './ScopedReferenceBuilder'
import { LoopReferenceBuilder } from './LoopReferenceBuilder'
import { ChainableLoopRef, ChainableRef, ChainableScopedRef } from './types'
import { splitKey } from './utils/splitKey'
import { captureCallsite, stampCallsite } from './utils/captureCallsite'
import { FieldBlockDefinition, ResolvableString } from '../../components/types/structures.type'

/**
 * References POST body data from form submission.
 */
export function Post(key: string): ChainableRef {
  const ref = ReferenceBuilder.create(['post', ...splitKey(key)])
  stampCallsite(ref, captureCallsite(Post))
  return ref
}

/**
 * References URL parameters (e.g., /users/:id).
 */
export function Params(key: string): ChainableRef {
  const ref = ReferenceBuilder.create(['params', ...splitKey(key)])
  stampCallsite(ref, captureCallsite(Params))
  return ref
}

/**
 * References query string parameters (e.g., ?search=test).
 */
export function Query(key: string): ChainableRef {
  const ref = ReferenceBuilder.create(['query', ...splitKey(key)])
  stampCallsite(ref, captureCallsite(Query))
  return ref
}

/**
 * References request metadata from the current request context.
 */
export const Request = {
  Url(): ChainableRef {
    const ref = ReferenceBuilder.create(['request', 'url'])
    stampCallsite(ref, captureCallsite(Request.Url))
    return ref
  },

  Path(): ChainableRef {
    const ref = ReferenceBuilder.create(['request', 'path'])
    stampCallsite(ref, captureCallsite(Request.Path))
    return ref
  },

  Method(): ChainableRef {
    const ref = ReferenceBuilder.create(['request', 'method'])
    stampCallsite(ref, captureCallsite(Request.Method))
    return ref
  },

  Headers(name: string): ChainableRef {
    const ref = ReferenceBuilder.create(['request', 'headers', name])
    stampCallsite(ref, captureCallsite(Request.Headers))
    return ref
  },

  Cookies(name: string): ChainableRef {
    const ref = ReferenceBuilder.create(['request', 'cookies', name])
    stampCallsite(ref, captureCallsite(Request.Cookies))
    return ref
  },

  State(key: string): ChainableRef {
    const ref = ReferenceBuilder.create(['request', 'state', ...splitKey(key)])
    stampCallsite(ref, captureCallsite(Request.State))
    return ref
  },
}

/**
 * References data defined for the step.
 */
export function Data(key: string): ChainableRef {
  const ref = ReferenceBuilder.create(['data', ...splitKey(key)])
  stampCallsite(ref, captureCallsite(Data))
  return ref
}

/**
 * References server-side session data from the current request context.
 */
export function Session(key: string): ChainableRef {
  const ref = ReferenceBuilder.create(['session', ...splitKey(key)])
  stampCallsite(ref, captureCallsite(Session))
  return ref
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
  const callsite = captureCallsite(Answer)

  const create = (ref: ChainableRef): ChainableRef => {
    stampCallsite(ref, callsite)
    return ref
  }

  // If it's a field block definition, use its code property
  if (isFieldBlockDefinition(target)) {
    const { code } = target

    // String code - split dot notation
    if (typeof code === 'string') {
      return create(ReferenceBuilder.create(['answers', ...splitKey(code)]))
    }

    // Dynamic code (expression) - pass through
    return create(ReferenceBuilder.create(['answers', code as any]))
  }

  // String target - split dot notation
  if (typeof target === 'string') {
    return create(ReferenceBuilder.create(['answers', ...splitKey(target)]))
  }

  // Otherwise, use the target directly (expression types like Format)
  return create(ReferenceBuilder.create(['answers', target as any]))
}

/**
 * References the current collection item when inside a collection scope.
 *
 * Prefer {@link Loop}.Item() — it keeps all loop access under one namespace,
 * and nested loops read as Loop.Parent.Item() instead of Item().parent.
 *
 * @example
 * Item().path('name')  // Access item.name
 * Item().value()  // Access the whole item
 * Item().parent.path('groupId')  // Access parent item's property
 */
export function Item(): ChainableScopedRef {
  const ref = ScopedReferenceBuilder.create(0)
  stampCallsite(ref, captureCallsite(Item))
  return ref
}

const createLoop = (): ChainableLoopRef => {
  return LoopReferenceBuilder.create(0)
}

/**
 * References the current collection loop: its item and its metadata.
 *
 * @example
 * Loop.Item().path('name')  // Current item's name property
 * Loop.Index()  // 1-based iteration position
 * Loop.Index0()  // 0-based iteration index
 * Loop.Parent.Item().value()  // Parent loop's item in nested iterations
 * Loop.Parent.Index()  // Parent loop position in nested iterations
 */
export const Loop: ChainableLoopRef = createLoop()

/**
 * References the block/field it's in scope of.
 *
 * @example
 * Self().match(Condition.IsRequired())
 * Self().not.match(Condition.String.IsEmpty())
 * Self().pipe(Transformer.String.Trim).match(Condition.IsRequired())
 */
export function Self(): ChainableRef {
  const ref = ReferenceBuilder.create(['answers', '@self'])
  stampCallsite(ref, captureCallsite(Self))
  return ref
}
