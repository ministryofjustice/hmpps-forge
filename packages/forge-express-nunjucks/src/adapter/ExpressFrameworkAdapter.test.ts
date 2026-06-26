import type { Environment } from 'nunjucks'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import { ExpressFrameworkAdapter } from './ExpressFrameworkAdapter'

describe('ExpressFrameworkAdapter', () => {
  describe('configure()', () => {
    it('should build an Express router from Forge', () => {
      // Arrange
      const adapter = ExpressFrameworkAdapter.configure({ nunjucksEnv: createNunjucksEnv() })
      const forge = createForge()

      // Act
      const router = adapter.build(forge)

      // Assert
      expect(router).toEqual(expect.objectContaining({ handle: expect.any(Function) }))
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
