import ForgeIteratorBudgetExceededError from '../../../errors/ForgeIteratorBudgetExceededError'
import type { IteratorBudgetContract } from '../../contracts/runtime/iteratorBudget.type'

export const DEFAULT_MAX_ITERATOR_ITERATIONS = 10_000

export default class IteratorBudget implements IteratorBudgetContract {
  private consumedIterations = 0

  constructor(private readonly maxIterations: number = DEFAULT_MAX_ITERATOR_ITERATIONS) {
    if (!Number.isSafeInteger(maxIterations) || maxIterations < 1) {
      throw new TypeError('maxIteratorIterations must be a positive integer')
    }
  }

  consume(): void {
    this.consumedIterations += 1

    if (this.consumedIterations > this.maxIterations) {
      throw new ForgeIteratorBudgetExceededError(this.maxIterations)
    }
  }
}
