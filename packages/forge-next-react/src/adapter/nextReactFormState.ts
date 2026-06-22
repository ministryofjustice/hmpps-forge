import { isValidElement, type ReactNode } from 'react'
import type { RenderContext } from '@ministryofjustice/hmpps-forge/core/framework'
import type { NextForgeFormState } from '@ministryofjustice/hmpps-forge/next-react/client'

export function createFormState(
  path: string,
  context: RenderContext,
  blocks: readonly ReactNode[],
): NextForgeFormState {
  const blockNodes = [...blocks]

  assertSerializableNode(blockNodes)

  return {
    path,
    title: context.step.title ?? 'Forge',
    blocks: blockNodes,
  }
}

export function assertSerializableNode(node: ReactNode): void {
  if (
    node === undefined ||
    node === null ||
    typeof node === 'string' ||
    typeof node === 'number' ||
    typeof node === 'boolean'
  ) {
    return
  }

  if (typeof node === 'function' || typeof node === 'symbol') {
    throw new Error(
      'A Forge component returned a non-serializable value. ' +
        'Components used with createNextForgePage must return plain JSX elements (no functions or symbols).',
    )
  }

  if (Array.isArray(node)) {
    node.forEach(assertSerializableNode)

    return
  }

  if (isValidElement(node)) {
    const props = node.props as Record<string, unknown>

    if (typeof node.type === 'string') {
      assertSerializableProps(node.type, props)
    }

    if (props.children !== undefined) {
      assertSerializableNode(props.children as ReactNode)
    }

    return
  }

  throw new Error(
    'A Forge component returned a non-serializable object. ' +
      'Components used with createNextForgePage must return plain JSX elements.',
  )
}

function assertSerializableProps(elementType: string, props: Record<string, unknown>): void {
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'children' || key === 'key' || key === 'ref') {
      return
    }

    if (typeof value === 'function') {
      throw new Error(
        `A Forge component rendered <${elementType}> with a function prop "${key}". ` +
          'Event handlers cannot be serialized across the server/client boundary. ' +
          'Remove the handler or use a client component wrapper.',
      )
    }

    if (typeof value === 'symbol') {
      throw new Error(
        `A Forge component rendered <${elementType}> with a symbol prop "${key}". ` +
          'Symbols cannot be serialized across the server/client boundary.',
      )
    }
  })
}
