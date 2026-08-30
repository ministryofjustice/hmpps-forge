import { describe, expect, it, vi } from 'vitest'
import { createForgePackage, journey, step, StructureType } from '../../../../src/authoring'
import ForgeDuplicateRouteError from '../../../../src/engine/errors/ForgeDuplicateRouteError'
import ForgeRegistrationError from '../../../../src/engine/errors/ForgeRegistrationError'
import { ForgeTestHarness } from '../../../../src/testing'
import { journeyAt } from './packageRegistration.fixtures'

describe('package registration contracts', () => {
  describe('package gate', () => {
    it('should reject a package that was not created with createForgePackage', () => {
      // Arrange
      const harness = new ForgeTestHarness()

      // Act
      const act = () => harness.registerPackage(journeyAt('bare') as never)

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Packages must be created with createForgePackage(...) before registration')
    })

    it('should skip registration when the package is disabled', async () => {
      // Arrange
      const client = new ForgeTestHarness()
        .registerPackage(createForgePackage({ journey: journeyAt('flagged'), enabled: false }))
        .createClient()

      // Act
      const act = () => client.get('/flagged/start', { session: {} })

      // Assert
      await expect(act()).rejects.toThrow('No route matched GET /flagged/start')
    })
  })

  describe('non-strict registration', () => {
    const invalidStepJourney = JSON.stringify({
      type: StructureType.JOURNEY,
      code: 'bad',
      path: '/bad',
      title: 'Bad',
      steps: [{ type: StructureType.STEP, path: '/start' }],
    })

    it('should log the registration failure and continue when strictRegistration is false', () => {
      // Arrange
      const errorSpy = vi.fn()
      const logger = { info: vi.fn(), warn: vi.fn(), error: errorSpy, debug: vi.fn() } as unknown as Console
      const harness = new ForgeTestHarness({ strictRegistration: false, logger })

      // Act
      const act = () => harness.registerPackage(createForgePackage({ journey: invalidStepJourney }))

      // Assert
      expect(act).not.toThrow()
      expect(errorSpy).toHaveBeenCalledTimes(1)
    })

    it('should leave the failing journey unmounted when strictRegistration is false', async () => {
      // Arrange
      const client = new ForgeTestHarness({ strictRegistration: false })
        .registerPackage(createForgePackage({ journey: invalidStepJourney }))
        .createClient()

      // Act
      const act = () => client.get('/bad/start', { session: {} })

      // Assert
      await expect(act()).rejects.toThrow('No route matched GET /bad/start')
    })
  })

  describe('duplicate routes', () => {
    it('should throw a duplicate route error when two steps share a path', () => {
      // Arrange
      const clashingSteps = journey({
        code: 'clash',
        title: 'Clash',
        path: '/clash',
        reachability: { disableReachabilityChecks: true },
        steps: [
          step({ code: 'first', title: 'First', path: '/same', blocks: [] }),
          step({ code: 'second', title: 'Second', path: '/same', blocks: [] }),
        ],
      })

      // Act
      const act = () => new ForgeTestHarness().registerPackage(createForgePackage({ journey: clashingSteps }))

      // Assert
      expect(act).toThrow(ForgeDuplicateRouteError)
      expect(act).toThrow('Duplicate route path: /clash/same')
    })

    it('should throw a duplicate route error when a second package claims a mounted path', () => {
      // Arrange
      const harness = new ForgeTestHarness().registerPackage(
        createForgePackage({ journey: journeyAt('first', '/shared') }),
      )

      // Act
      const act = () => harness.registerPackage(createForgePackage({ journey: journeyAt('second', '/shared') }))

      // Assert
      expect(act).toThrow(ForgeDuplicateRouteError)
      expect(act).toThrow('Duplicate route path: /shared')
    })
  })
})
