import { pickTieBreakerWinner, resolveBacklinkRouteTemplatePathForStep } from './NavigationPathAnalyzer'
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
})
