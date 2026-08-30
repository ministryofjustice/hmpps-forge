import { createForgePackage, journey } from '../../../../src/authoring'
import { ForgeTestHarness } from '../../../../src/testing'
import { contractFunctionRegistries } from '../../contractHelpers'

/** Registers a raw definition the way JSON-authored journeys arrive: serialized, no builders. */
export function registerRawJourney(rawJourney: object): void {
  new ForgeTestHarness().registerPackage(
    createForgePackage({ journey: JSON.stringify(rawJourney), functions: contractFunctionRegistries }),
  )
}

export function registerJourney(journeyDefinition: ReturnType<typeof journey>): void {
  new ForgeTestHarness().registerPackage(
    createForgePackage({ journey: journeyDefinition, functions: contractFunctionRegistries }),
  )
}
