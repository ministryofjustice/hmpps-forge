import { createForgePackage, journey } from '../../../../src/authoring'
import { ForgeTestHarness } from '../../../../src/testing'

/** Registers a raw definition the way JSON-authored journeys arrive: serialized, no builders. */
export function registerRawJourney(rawJourney: object): void {
  new ForgeTestHarness().registerPackage(createForgePackage({ journey: JSON.stringify(rawJourney) }))
}

export function registerJourney(journeyDefinition: ReturnType<typeof journey>): void {
  new ForgeTestHarness().registerPackage(createForgePackage({ journey: journeyDefinition }))
}
