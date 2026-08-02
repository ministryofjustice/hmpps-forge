import { createForgePackage, field, journey, step } from '../../authoring/builders'
import ForgeRegistrationError from './ForgeRegistrationError'
import Forge from '../Forge'

describe('RegistrationErrorFormatter', () => {
  it('should include a Defined at line pointing at the author callsite for semantic validation errors', () => {
    // Arrange
    const badJourney = journey({
      code: 'callsite-journey',
      title: 'Callsite Journey',
      path: '/callsite-journey',
      reachability: { disableReachabilityChecks: true },
      steps: [
        step({
          code: 'step-one',
          title: 'Step One',
          path: '/step-one',
          blocks: [field({ variant: 'nonExistentComponent', code: 'field1' })],
        }),
      ],
    })
    const engine = new Forge({})

    // Act
    const act = () => engine.registerPackage(createForgePackage({ journey: badJourney }))

    // Assert
    expect(act).toThrow(ForgeRegistrationError)

    try {
      act()
    } catch (error) {
      expect(error).toBeInstanceOf(ForgeRegistrationError)

      if (error instanceof ForgeRegistrationError) {
        expect(error.message).toContain('Component variant "nonExistentComponent" is not registered')
        expect(error.message).toContain('Defined at: ')
        expect(error.message).toContain('RegistrationErrorFormatter.test.ts')
      }
    }
  })
})
