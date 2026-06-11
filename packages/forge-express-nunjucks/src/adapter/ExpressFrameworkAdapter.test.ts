import type express from 'express'
import type nunjucks from 'nunjucks'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import { createExpressRouter } from './createExpressRouter'
import { ExpressFrameworkAdapter } from './ExpressFrameworkAdapter'

vi.mock('./createExpressRouter', () => ({
  createExpressRouter: vi.fn(),
}))

describe('ExpressFrameworkAdapter', () => {
  describe('configure()', () => {
    it('should build the router through createExpressRouter with the configured options', () => {
      // Arrange
      const nunjucksEnv = {} as nunjucks.Environment
      const forge = {} as Forge
      const router = {} as express.Router
      vi.mocked(createExpressRouter).mockReturnValue(router)

      // Act
      const adapter = ExpressFrameworkAdapter.configure({ nunjucksEnv, defaultTemplate: 'custom-step' })
      const built = adapter.build(forge)

      // Assert
      expect(createExpressRouter).toHaveBeenCalledWith(forge, { nunjucksEnv, defaultTemplate: 'custom-step' })
      expect(built).toBe(router)
    })
  })
})
