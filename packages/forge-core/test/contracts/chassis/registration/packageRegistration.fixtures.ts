import { journey, step } from '../../../../src/authoring'

/** A minimal one-step journey for exercising registration mechanics, mounted at `basePath`. */
export function journeyAt(code: string, basePath = `/${code}`) {
  return journey({
    code,
    title: `Journey ${code}`,
    path: basePath,
    reachability: { disableReachabilityChecks: true },
    steps: [step({ code: 'start', title: 'Start', path: '/start', blocks: [] })],
  })
}
