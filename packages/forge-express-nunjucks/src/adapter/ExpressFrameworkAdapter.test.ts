import type { Environment } from 'nunjucks'
import type { MockInstance } from 'vitest'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import { ExpressFrameworkAdapter } from './ExpressFrameworkAdapter'

const SEEN_CODES = Symbol.for('forge:deprecations')

describe('ExpressFrameworkAdapter', () => {
  describe('configure()', () => {
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

    it('should build an Express router from Forge', () => {
      // Arrange
      const adapter = ExpressFrameworkAdapter.configure({ nunjucksEnv: createNunjucksEnv() })
      const forge = createForge()

      // Act
      const router = adapter.build(forge)

      // Assert
      expect(router).toEqual(expect.objectContaining({ handle: expect.any(Function) }))
    })

    it('should emit a deprecation warning when configured', () => {
      // Act
      ExpressFrameworkAdapter.configure({ nunjucksEnv: createNunjucksEnv() })

      // Assert
      expect(emitWarning).toHaveBeenCalledTimes(1)
      expect(emitWarning).toHaveBeenCalledWith(
        'ExpressFrameworkAdapter is deprecated - build the router directly with createExpressRouter(forge, options).',
        { type: 'DeprecationWarning', code: 'FORGE_DEP_ExpressFrameworkAdapter' },
      )
    })

    it('should warn once when configured a second time', () => {
      // Act
      ExpressFrameworkAdapter.configure({ nunjucksEnv: createNunjucksEnv() })
      ExpressFrameworkAdapter.configure({ nunjucksEnv: createNunjucksEnv() })

      // Assert
      expect(emitWarning).toHaveBeenCalledTimes(1)
    })
  })
})

function createForge(): Forge {
  return {
    getLogger: () => ({ debug: vi.fn() }),
    getTopology: () => ({ routes: [] }),
  } as unknown as Forge
}

function createNunjucksEnv(): Environment {
  return {
    getTemplate: vi.fn(),
  } as unknown as Environment
}
