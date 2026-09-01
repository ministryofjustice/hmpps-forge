import { createForgePackage, journey, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { ForgeRenderer } from '@ministryofjustice/hmpps-forge/core/framework'
import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'

import { LlmContent } from '../../components/content/llmContent'
import { LlmDate } from '../../components/date/llmDate'
import { LlmFreeText } from '../../components/free-text/llmFreeText'
import { LlmMultiSelect } from '../../components/multi-select/llmMultiSelect'
import { LlmSingleSelect } from '../../components/single-select/llmSingleSelect'
import { LlmTurn, type LlmTurnBlocks } from './llmTurn'

const llmTurnStep = step<LlmTurnBlocks>

const llmTurnJourney = journey({
  code: 'property',
  path: '/property',
  title: 'Tell us about your property',
  reachability: { disableReachabilityChecks: true },
  renderer: LlmTurn(),
  steps: [
    llmTurnStep({
      path: '/ownership',
      title: 'Property ownership',
      blocks: {
        content: [LlmContent({ content: 'First, I need to know whether you own a property.' })],
        questions: [
          LlmSingleSelect({
            code: 'ownsProperty',
            prompt: 'Do you own a property?',
            options: [
              { value: 'yes', text: 'Yes' },
              { value: 'no', text: 'No' },
            ],
          }),
        ],
      },
    }),
    llmTurnStep({
      path: '/details',
      title: 'Property details',
      blocks: {
        content: [
          LlmContent({ content: 'Now tell me a little more about the property.' }),
          LlmContent({ content: 'This should not be rendered.', visibleWhen: false }),
        ],
        questions: [
          LlmFreeText({
            code: 'propertyColour',
            prompt: 'What colour is the property?',
          }),
          LlmDate({
            code: 'purchaseDate',
            prompt: 'When did you buy it?',
          }),
          LlmMultiSelect({
            code: 'propertyFeatures',
            prompt: 'Which features does it have?',
            options: [
              { value: 'garden', text: 'Garden' },
              { value: 'garage', text: 'Garage' },
              { value: 'driveway', text: 'Driveway' },
            ],
          }),
        ],
      },
    }),
  ],
})

const structuredOutputRenderer: ForgeRenderer<unknown> = {
  wrapNestedBlock: (_block, output) => output,
  assemblePage: () => {
    throw new Error('LlmTurn should replace adapter page assembly')
  },
}

describe('LlmTurn', () => {
  it('should render each journey step as a structured conversation turn', async () => {
    // Arrange
    const client = new ForgeTestHarness()
      .registerPackage(createForgePackage({ journey: llmTurnJourney }))
      .createClient(structuredOutputRenderer)

    // Act
    const ownershipResult = await client.get('/property/ownership', { session: {} })
    const detailsResult = await client.get('/property/details', { session: {} })

    // Assert
    expect(ownershipResult.type).toBe('render')
    expect(detailsResult.type).toBe('render')

    if (ownershipResult.type === 'render') {
      expect(ownershipResult.output).toEqual({
        content: [
          {
            kind: 'content',
            content: 'First, I need to know whether you own a property.',
          },
        ],
        questions: [
          {
            kind: 'single-select',
            code: 'ownsProperty',
            prompt: 'Do you own a property?',
            hint: undefined,
            options: [
              { value: 'yes', text: 'Yes', hint: undefined },
              { value: 'no', text: 'No', hint: undefined },
            ],
            value: undefined,
            errors: [],
          },
        ],
      })
    }

    if (detailsResult.type === 'render') {
      expect(detailsResult.output).toEqual({
        content: [
          {
            kind: 'content',
            content: 'Now tell me a little more about the property.',
          },
        ],
        questions: [
          {
            kind: 'free-text',
            code: 'propertyColour',
            prompt: 'What colour is the property?',
            hint: undefined,
            value: undefined,
            errors: [],
          },
          {
            kind: 'date',
            code: 'purchaseDate',
            prompt: 'When did you buy it?',
            hint: undefined,
            value: undefined,
            errors: [],
          },
          {
            kind: 'multi-select',
            code: 'propertyFeatures',
            prompt: 'Which features does it have?',
            hint: undefined,
            options: [
              { value: 'garden', text: 'Garden', hint: undefined },
              { value: 'garage', text: 'Garage', hint: undefined },
              { value: 'driveway', text: 'Driveway', hint: undefined },
            ],
            value: [],
            errors: [],
          },
        ],
      })
    }
  })
})
