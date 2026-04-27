import {
  BlockType,
  ExpressionType,
  FunctionType,
  HookType,
  IteratorType,
  PredicateType,
  StructureType,
} from '../../authoring/types/enums'
import { formatDSLPath } from './formatDSLPath'

describe('formatDSLPath', () => {
  it('should format a field validation error path with block context', () => {
    // Arrange
    const journey = {
      type: StructureType.JOURNEY,
      code: 'travel-declaration',
      path: '/travel-declaration',
      title: 'Travel declaration',
      steps: [
        {
          type: StructureType.STEP,
          path: '/personal-details',
          title: 'Personal details',
          blocks: [
            {
              type: StructureType.BLOCK,
              blockType: BlockType.FIELD,
              variant: 'GovUKInput',
              code: 'firstName',
            },
          ],
        },
      ],
    }

    // Act
    const result = formatDSLPath(journey, ['steps', 0, 'blocks', 0, 'validWhen', 0, 'message'])

    // Assert
    expect(result).toBe(
      'travel-declaration > personal-details > blocks[0] (GovUKInput - firstName) > validWhen[0] > message',
    )
  })

  it('should format a basic block path without a field code', () => {
    // Arrange
    const journey = {
      type: StructureType.JOURNEY,
      code: 'travel-declaration',
      path: '/travel-declaration',
      title: 'Travel declaration',
      steps: [
        {
          type: StructureType.STEP,
          path: '/personal-details',
          title: 'Personal details',
          blocks: [
            { type: StructureType.BLOCK, blockType: BlockType.BASIC, variant: 'GovUKBody' },
            { type: StructureType.BLOCK, blockType: BlockType.BASIC, variant: 'GovUKInsetText' },
            { type: StructureType.BLOCK, blockType: BlockType.BASIC, variant: 'GovUKHtml' },
          ],
        },
      ],
    }

    // Act
    const result = formatDSLPath(journey, ['steps', 0, 'blocks', 2, 'visibleWhen'])

    // Assert
    expect(result).toBe('travel-declaration > personal-details > blocks[2] (GovUKHtml) > visibleWhen')
  })

  it('should format hook paths with function context', () => {
    // Arrange
    const journey = {
      type: StructureType.JOURNEY,
      code: 'travel-declaration',
      path: '/travel-declaration',
      title: 'Travel declaration',
      steps: [
        {
          type: StructureType.STEP,
          path: '/personal-details',
          title: 'Personal details',
          blocks: [],
          onSubmission: [
            {
              type: HookType.SUBMIT,
              onValid: {
                effects: [
                  {
                    type: FunctionType.EFFECT,
                    name: 'saveAnswers',
                    arguments: ['one', 'two', 'three'],
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    // Act
    const result = formatDSLPath(journey, ['steps', 0, 'onSubmission', 0, 'onValid', 'effects', 0, 'arguments', 2])

    // Assert
    expect(result).toBe(
      'travel-declaration > personal-details > onSubmission[0] > onValid > effects[0] (effect - saveAnswers) > arguments[2]',
    )
  })

  it('should format nested journey paths', () => {
    // Arrange
    const journey = {
      type: StructureType.JOURNEY,
      code: 'case-management',
      path: '/case-management',
      title: 'Case management',
      children: [
        {
          type: StructureType.JOURNEY,
          code: 'sentence-plan',
          path: '/sentence-plan',
          title: 'Sentence plan',
          steps: [
            {
              type: StructureType.STEP,
              path: '/review-goals',
              title: 'Review goals',
              blocks: [
                {
                  type: StructureType.BLOCK,
                  blockType: BlockType.FIELD,
                  variant: 'GovUKRadios',
                  code: 'decision',
                },
              ],
            },
          ],
        },
      ],
    }

    // Act
    const result = formatDSLPath(journey, ['children', 0, 'steps', 0, 'blocks', 0, 'validWhen', 0, 'condition'])

    // Assert
    expect(result).toBe(
      'case-management > sentence-plan > review-goals > blocks[0] (GovUKRadios - decision) > validWhen[0] > condition',
    )
  })

  it('should format collection block iterator template paths', () => {
    // Arrange
    const journey = {
      type: StructureType.JOURNEY,
      code: 'travel-declaration',
      path: '/travel-declaration',
      title: 'Travel declaration',
      steps: [
        {
          type: StructureType.STEP,
          path: '/trips',
          title: 'Trips',
          blocks: [
            {
              type: StructureType.BLOCK,
              blockType: BlockType.BASIC,
              variant: 'collection-block',
              collection: {
                type: ExpressionType.ITERATE,
                input: { type: ExpressionType.REFERENCE, path: ['answers', 'trips'] },
                iterator: {
                  type: IteratorType.MAP,
                  yield: {
                    blocks: [
                      {
                        type: StructureType.BLOCK,
                        blockType: BlockType.FIELD,
                        variant: 'GovUKInput',
                        code: 'country',
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      ],
    }

    // Act
    const result = formatDSLPath(journey, [
      'steps',
      0,
      'blocks',
      0,
      'collection',
      'iterator',
      'yield',
      'blocks',
      0,
      'validWhen',
      0,
    ])

    // Assert
    expect(result).toBe(
      'travel-declaration > trips > blocks[0] (collection-block) > collection > source > iterator > template > blocks[0] (GovUKInput - country) > validWhen[0]',
    )
  })

  it('should format function argument errors inside field validation', () => {
    // Arrange
    const journey = {
      type: StructureType.JOURNEY,
      code: 'travel-declaration',
      path: '/travel-declaration',
      title: 'Travel declaration',
      steps: [
        {
          type: StructureType.STEP,
          path: '/trips',
          title: 'Trips',
          blocks: [
            {
              type: StructureType.BLOCK,
              blockType: BlockType.FIELD,
              variant: 'GovUKInput',
              code: 'departure',
              validWhen: [
                {
                  type: ExpressionType.VALIDATION,
                  message: 'Enter a departure date',
                  condition: {
                    type: PredicateType.TEST,
                    subject: { type: ExpressionType.REFERENCE, path: ['answers', 'departure'] },
                    condition: {
                      type: FunctionType.CONDITION,
                      name: 'AfterDate',
                      arguments: ['today', 'tomorrow'],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    // Act
    const result = formatDSLPath(journey, [
      'steps',
      0,
      'blocks',
      0,
      'validWhen',
      0,
      'condition',
      'condition',
      'arguments',
      1,
    ])

    // Assert
    expect(result).toBe(
      'travel-declaration > trips > blocks[0] (GovUKInput - departure) > validWhen[0] > condition > arguments[1]',
    )
  })
})
