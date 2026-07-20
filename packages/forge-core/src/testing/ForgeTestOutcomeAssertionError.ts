export default class ForgeTestOutcomeAssertionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ForgeTestOutcomeAssertionError'
  }
}
