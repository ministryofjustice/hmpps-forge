import type { MockInstance } from 'vitest'
import { ForgeDeprecations } from './ForgeDeprecations'

const SEEN_CODES = Symbol.for('forge:deprecations')

describe('ForgeDeprecations', () => {
  describe('warn()', () => {
    let emitWarning: MockInstance<typeof process.emitWarning>

    beforeEach(() => {
      // The seen-codes set lives on globalThis and persists across tests/files in the same
      // process, so clear it to isolate each case.
      delete (globalThis as Record<symbol, unknown>)[SEEN_CODES]
      emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})
    })

    afterEach(() => {
      emitWarning.mockRestore()
    })

    it('should emit the warning when a code is seen for the first time', () => {
      // Act
      ForgeDeprecations.warn('FORGE_DEP_example', 'example is deprecated')

      // Assert
      expect(emitWarning).toHaveBeenCalledTimes(1)
      expect(emitWarning).toHaveBeenCalledWith('example is deprecated', {
        type: 'DeprecationWarning',
        code: 'FORGE_DEP_example',
      })
    })

    it('should stay silent when the same code is warned a second time', () => {
      // Act
      ForgeDeprecations.warn('FORGE_DEP_example', 'example is deprecated')
      ForgeDeprecations.warn('FORGE_DEP_example', 'example is deprecated')

      // Assert
      expect(emitWarning).toHaveBeenCalledTimes(1)
    })

    it('should emit separately when different codes are warned', () => {
      // Act
      ForgeDeprecations.warn('FORGE_DEP_one', 'one is deprecated')
      ForgeDeprecations.warn('FORGE_DEP_two', 'two is deprecated')

      // Assert
      expect(emitWarning).toHaveBeenCalledTimes(2)
    })

    it('should store seen codes on globalThis under the forge:deprecations symbol', () => {
      // Act
      ForgeDeprecations.warn('FORGE_DEP_example', 'example is deprecated')

      // Assert
      const seen = (globalThis as Record<symbol, unknown>)[SEEN_CODES]
      expect(seen).toBeInstanceOf(Set)
      expect(seen).toContain('FORGE_DEP_example')
    })
  })
})
