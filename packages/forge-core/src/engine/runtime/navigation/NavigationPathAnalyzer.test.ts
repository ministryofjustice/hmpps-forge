import {
  pickTieBreakerWinner,
  resolveBacklinkRouteTemplatePathForStep,
  resolveDefaultEntryRouteTemplatePath,
} from './NavigationPathAnalyzer'
import type { NavigationStepState } from '../../contracts/navigation/navigationEvaluation.type'

function createNavigationStep(overrides: Partial<NavigationStepState> = {}): NavigationStepState {
  return {
    stepNodeId: 'compile_ast:500',
    routeTemplatePath: '/journey/current',
    declarationIndex: 0,
    isEntryPoint: false,
    isConditionalEntry: false,
    hasValidation: false,
    isReachable: true,
    isValid: true,
    forwardRouteTemplatePaths: [],
    predecessorRouteTemplatePaths: [],
    ...overrides,
  }
}

describe('NavigationPathAnalyzer helpers', () => {
  it('should resolve backlinks from the canonical path', () => {
    // Arrange
    const current = createNavigationStep({ routeTemplatePath: '/journey/converge' })

    // Act / Assert
    expect(
      resolveBacklinkRouteTemplatePathForStep(current, ['/journey/start', '/journey/branch-b', '/journey/converge']),
    ).toBe('/journey/branch-b')
    expect(resolveBacklinkRouteTemplatePathForStep(current, ['/journey/start'])).toBeUndefined()
  })

  it('should pick tie-breaker winners by priority then declaration order', () => {
    // Arrange
    const first = createNavigationStep({ stepNodeId: 'compile_ast:510', tieBreakerPriority: 5 })
    const second = createNavigationStep({ stepNodeId: 'compile_ast:511', tieBreakerPriority: 10 })
    const unmatched = createNavigationStep({ stepNodeId: 'compile_ast:512' })

    // Act / Assert
    expect(pickTieBreakerWinner([first, second])).toBe(second)
    expect(pickTieBreakerWinner([first, { ...second, tieBreakerPriority: 5 }])).toBe(first)
    expect(pickTieBreakerWinner([unmatched, first])).toBe(first)
    expect(pickTieBreakerWinner([])).toBeUndefined()
  })

  it('should resolve the default entry from active entries when present', () => {
    // Arrange
    const entry = createNavigationStep({ routeTemplatePath: '/journey/start', isEntryPoint: true })
    const conditionalEntry = createNavigationStep({
      routeTemplatePath: '/journey/alt-start',
      isConditionalEntry: true,
      tieBreakerPriority: 10,
    })
    const nonEntry = createNavigationStep({ routeTemplatePath: '/journey/middle' })

    // Act / Assert
    expect(resolveDefaultEntryRouteTemplatePath([entry, conditionalEntry, nonEntry])).toBe('/journey/alt-start')
    expect(resolveDefaultEntryRouteTemplatePath([entry, nonEntry])).toBe('/journey/start')
  })

  it('should fall back to the first declared step when no entry is active', () => {
    // Arrange
    const first = createNavigationStep({ routeTemplatePath: '/journey/first' })
    const second = createNavigationStep({ routeTemplatePath: '/journey/second' })

    // Act / Assert
    expect(resolveDefaultEntryRouteTemplatePath([first, second])).toBe('/journey/first')
    expect(resolveDefaultEntryRouteTemplatePath([])).toBeUndefined()
  })
})
