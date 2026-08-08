import ForgeBaseError from './ForgeBaseError'

export default class ForgeRegistrationError extends ForgeBaseError {
  constructor(message: string) {
    super(message)
    this.stack = this.message
  }
}
