export default class ForgeRegistrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ForgeRegistrationError'
    this.stack = this.message
  }
}
