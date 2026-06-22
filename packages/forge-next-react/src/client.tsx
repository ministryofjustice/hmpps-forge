'use client'

import { useActionState } from 'react'
import type { ReactNode } from 'react'

export interface NextForgeFormState {
  path: string
  title: string
  blocks: ReactNode
}

export type NextForgeFormAction = (
  _state: NextForgeFormState,
  _formData: FormData,
) => Promise<NextForgeFormState> | NextForgeFormState

export interface ForgeActionFormProps {
  initialState: NextForgeFormState
  action: NextForgeFormAction
}

export function ForgeActionForm({ initialState, action }: ForgeActionFormProps): ReactNode {
  const [state, formAction, isPending] = useActionState(action, initialState, initialState.path)

  return <main>
    <h1>{state.title}</h1>
    <form method="post" action={formAction} aria-busy={isPending || undefined}>
      {state.blocks}
    </form>
  </main>
}
