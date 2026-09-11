import { effect, type EffectFunctionContext } from '@ministryofjustice/hmpps-forge/core/authoring'

type PatternSession = {
  demoUser?: { name: string; role: 'admin' | 'viewer' }
}

type PatternEffectContext = EffectFunctionContext<Record<string, unknown>, Record<string, unknown>, PatternSession>

/** Simulates the session identity normally supplied by authentication middleware. */
export const simulateLogin = effect({
  name: 'SimulateLogin',
  factory: () => (context: PatternEffectContext, name: string, role: 'admin' | 'viewer') => {
    const session = context.getSession()

    if (!session) {
      return
    }

    session.demoUser = { name, role }
  },
})

/** Removes the simulated identity so protected routes require login again. */
export const simulateLogout = effect({
  name: 'SimulateLogout',
  factory: () => (context: PatternEffectContext) => {
    const session = context.getSession()

    if (!session) {
      return
    }

    delete session.demoUser
  },
})
