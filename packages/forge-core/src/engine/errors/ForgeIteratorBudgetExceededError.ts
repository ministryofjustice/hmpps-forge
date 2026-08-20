import ForgeBaseError from './ForgeBaseError'

export default class ForgeIteratorBudgetExceededError extends ForgeBaseError {
  constructor(maxIterations: number) {
    super(`Forge iterator evaluation exceeded the per-request limit of ${maxIterations} iterations`)
  }
}
