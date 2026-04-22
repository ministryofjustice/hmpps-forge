import { NavigationStepState } from './NavigationEvaluation.type'
import { pickTieBreakerWinner } from './tieBreakerSelection'

describe('tieBreakerSelection', () => {
  function createNavigationStep(overrides: Partial<NavigationStepState> = {}): NavigationStepState {
    return {
      stepId: 'compile_ast:1',
      routeTemplatePath: '/journey/step',
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

  describe('pickTieBreakerWinner()', () => {
    it('should return undefined when no candidates are supplied', () => {
      // Arrange
      const candidates: NavigationStepState[] = []

      // Act
      const result = pickTieBreakerWinner(candidates)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should return the only candidate when just one is supplied', () => {
      // Arrange
      const only = createNavigationStep({ stepId: 'compile_ast:2' })

      // Act
      const result = pickTieBreakerWinner([only])

      // Assert
      expect(result).toBe(only)
    })

    it('should pick the candidate with the highest priority', () => {
      // Arrange
      const first = createNavigationStep({ stepId: 'compile_ast:10', tieBreakerPriority: 10 })
      const second = createNavigationStep({ stepId: 'compile_ast:11', tieBreakerPriority: 100 })
      const third = createNavigationStep({ stepId: 'compile_ast:12', tieBreakerPriority: 50 })

      // Act
      const result = pickTieBreakerWinner([first, second, third])

      // Assert
      expect(result).toBe(second)
    })

    it('should fall back to journey order when all candidates are unmatched', () => {
      // Arrange
      const first = createNavigationStep({ stepId: 'compile_ast:20' })
      const second = createNavigationStep({ stepId: 'compile_ast:21' })

      // Act
      const result = pickTieBreakerWinner([first, second])

      // Assert
      expect(result).toBe(first)
    })

    it('should fall back to journey order when candidates tie on priority', () => {
      // Arrange
      const first = createNavigationStep({ stepId: 'compile_ast:30', tieBreakerPriority: 5 })
      const second = createNavigationStep({ stepId: 'compile_ast:31', tieBreakerPriority: 5 })

      // Act
      const result = pickTieBreakerWinner([first, second])

      // Assert
      expect(result).toBe(first)
    })

    it('should prefer a matched candidate over an unmatched one regardless of order', () => {
      // Arrange
      const unmatchedFirst = createNavigationStep({ stepId: 'compile_ast:40' })
      const matchedSecond = createNavigationStep({ stepId: 'compile_ast:41', tieBreakerPriority: 1 })

      // Act
      const result = pickTieBreakerWinner([unmatchedFirst, matchedSecond])

      // Assert
      expect(result).toBe(matchedSecond)
    })

    it('should treat negative priorities as still beating unmatched candidates', () => {
      // Arrange
      const unmatched = createNavigationStep({ stepId: 'compile_ast:50' })
      const negative = createNavigationStep({ stepId: 'compile_ast:51', tieBreakerPriority: -10 })

      // Act
      const result = pickTieBreakerWinner([unmatched, negative])

      // Assert
      expect(result).toBe(negative)
    })
  })
})
