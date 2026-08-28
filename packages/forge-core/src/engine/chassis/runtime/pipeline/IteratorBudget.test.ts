import { z } from 'zod'
import { Answer } from '../../../../authoring/builders/references'
import { Iterator } from '../../../../authoring/builders/iterators'
import { block, createForgePackage, field, journey, step } from '../../../../authoring/builders/structures'
import { CollectionBlock } from '../../../../built-ins/components/collectionBlock'
import { component } from '../../../../components/component'
import { ForgeTestHarness } from '../../../../testing/test-client/ForgeTestHarness'
import type { ForgeTestClient } from '../../../../testing/test-client/ForgeTestClient'
import IteratorBudget from './IteratorBudget'

const MultiValueField = component<object>('iterator-budget-multi-value', {
  field: true,
  render: () => '',
  inputSchema: z.array(z.string()),
  multiple: true,
})

const RepeatedBlock = component<object>('iterator-budget-repeated-block', { render: () => '' })

const iteratorBudgetJourney = journey({
  code: 'iterator-budget',
  title: 'Iterator budget',
  path: '/iterator-budget',
  reachability: { disableReachabilityChecks: true },
  steps: [
    step({
      code: 'step',
      title: 'Step',
      path: '/step',
      blocks: [
        field({ variant: MultiValueField.variant, code: 'choices' }),
        CollectionBlock({
          collection: Answer('choices').each(
            Iterator.Map([
              CollectionBlock({
                collection: Answer('choices').each(
                  Iterator.Map([
                    block({
                      variant: RepeatedBlock.variant,
                    }),
                  ]),
                ),
              }),
            ]),
          ),
        }),
      ],
    }),
  ],
})

describe('IteratorBudget', () => {
  describe('consume()', () => {
    it('should allow iterations up to the configured limit', () => {
      // Arrange
      const budget = new IteratorBudget(2)

      // Act
      const act = () => {
        budget.consume()
        budget.consume()
      }

      // Assert
      expect(act).not.toThrow()
    })

    it('should reject the first iteration beyond the configured limit', () => {
      // Arrange
      const budget = new IteratorBudget(2)
      budget.consume()
      budget.consume()

      // Act
      const act = () => budget.consume()

      // Assert
      expect(act).toThrow('Forge iterator evaluation exceeded the per-request limit of 2 iterations')
    })
  })

  describe('request evaluation', () => {
    let client: ForgeTestClient

    beforeEach(() => {
      client = new ForgeTestHarness({ maxIteratorIterations: 100 })
        .registerPackage(
          createForgePackage({ journey: iteratorBudgetJourney, components: [MultiValueField, RepeatedBlock] }),
        )
        .createClient()
    })

    it('should reset the iterator budget for each request', async () => {
      // Arrange
      const choices = Array.from({ length: 9 }, (_, index) => String(index))

      // Act
      const firstResult = await client.post('/iterator-budget/step', { body: { choices }, session: {} })
      const secondResult = await client.post('/iterator-budget/step', { body: { choices }, session: {} })

      // Assert
      expect(firstResult.type).toBe('render')
      expect(secondResult.type).toBe('render')
    })

    it('should stop nested iterators when their cumulative work exceeds the request budget', async () => {
      // Arrange
      const choices = Array.from({ length: 10 }, (_, index) => String(index))

      // Act
      const result = await client.post('/iterator-budget/step', { body: { choices }, session: {} })

      // Assert
      expect(result.type).toBe('error')

      if (result.type !== 'error') {
        throw new Error('Expected iterator budget exhaustion to return an error')
      }

      expect(result.error.message).toContain(
        'Forge iterator evaluation exceeded the per-request limit of 100 iterations',
      )
    })
  })
})
