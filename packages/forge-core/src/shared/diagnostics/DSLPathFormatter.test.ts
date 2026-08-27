import { PolicyType,
  ComponentCallType,
  ExpressionType,
  FunctionCallType,
  HookType,
  IteratorType,
  PredicateType,
  StructureType,
} from '../../authoring/types/enums'
import DSLPathFormatter from './DSLPathFormatter'

describe('DSLPathFormatter', () => {
  let formatter: DSLPathFormatter

  beforeEach(() => {
    formatter = new DSLPathFormatter()
  })

  it('should format a field validation error path with block context', () => {
    // Arrange
    const journey = {
      _forge: StructureType.JOURNEY,
      code: 'travel-declaration',
      path: '/travel-declaration',
      title: 'Travel declaration',
      steps: [
        {
          _forge: StructureType.STEP,
          path: '/personal-details',
          title: 'Personal details',
          blocks: [
            {
              _forge: ComponentCallType.FIELD,
              variant: 'GovUKInput',
              code: 'firstName',
            },
          ],
        },
      ],
    }

    // Act
    const result = formatter.format(journey, ['steps', 0, 'blocks', 0, 'validWhen', 0, 'message'])

    // Assert
    expect(result).toBe(
      'travel-declaration > personal-details > blocks[0] (GovUKInput - firstName) > validWhen[0] > message',
    )
  })

  it('should format a basic block path without a field code', () => {
    // Arrange
    const journey = {
      _forge: StructureType.JOURNEY,
      code: 'travel-declaration',
      path: '/travel-declaration',
      title: 'Travel declaration',
      steps: [
        {
          _forge: StructureType.STEP,
          path: '/personal-details',
          title: 'Personal details',
          blocks: [
            { _forge: ComponentCallType.BASIC, variant: 'GovUKBody' },
            { _forge: ComponentCallType.BASIC, variant: 'GovUKInsetText' },
            { _forge: ComponentCallType.BASIC, variant: 'GovUKHtml' },
          ],
        },
      ],
    }

    // Act
    const result = formatter.format(journey, ['steps', 0, 'blocks', 2, 'visibleWhen'])

    // Assert
    expect(result).toBe('travel-declaration > personal-details > blocks[2] (GovUKHtml) > visibleWhen')
  })

  it('should format hook paths with function context', () => {
    // Arrange
    const journey = {
      _forge: StructureType.JOURNEY,
      code: 'travel-declaration',
      path: '/travel-declaration',
      title: 'Travel declaration',
      steps: [
        {
          _forge: StructureType.STEP,
          path: '/personal-details',
          title: 'Personal details',
          blocks: [],
          onSubmission: [
            {
              _forge: HookType.SUBMIT,
              onValid: {
                effects: [
                  {
                    _forge: FunctionCallType.EFFECT,
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
    const result = formatter.format(journey, ['steps', 0, 'onSubmission', 0, 'onValid', 'effects', 0, 'arguments', 2])

    // Assert
    expect(result).toBe(
      'travel-declaration > personal-details > onSubmission[0] > onValid > effects[0] (effect - saveAnswers) > arguments[2]',
    )
  })

  it('should format nested journey paths', () => {
    // Arrange
    const journey = {
      _forge: StructureType.JOURNEY,
      code: 'case-management',
      path: '/case-management',
      title: 'Case management',
      children: [
        {
          _forge: StructureType.JOURNEY,
          code: 'sentence-plan',
          path: '/sentence-plan',
          title: 'Sentence plan',
          steps: [
            {
              _forge: StructureType.STEP,
              path: '/review-goals',
              title: 'Review goals',
              blocks: [
                {
                  _forge: ComponentCallType.FIELD,
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
    const result = formatter.format(journey, ['children', 0, 'steps', 0, 'blocks', 0, 'validWhen', 0, 'condition'])

    // Assert
    expect(result).toBe(
      'case-management > sentence-plan > review-goals > blocks[0] (GovUKRadios - decision) > validWhen[0] > condition',
    )
  })

  it('should format collection block iterator template paths', () => {
    // Arrange
    const journey = {
      _forge: StructureType.JOURNEY,
      code: 'travel-declaration',
      path: '/travel-declaration',
      title: 'Travel declaration',
      steps: [
        {
          _forge: StructureType.STEP,
          path: '/trips',
          title: 'Trips',
          blocks: [
            {
              _forge: ComponentCallType.BASIC,
              variant: 'collection-block',
              collection: {
                _forge: ExpressionType.ITERATE,
                input: { _forge: ExpressionType.REFERENCE, path: ['answers', 'trips'] },
                iterator: {
                  _forge: IteratorType.MAP,
                  yield: {
                    blocks: [
                      {
                        _forge: ComponentCallType.FIELD,
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
    const result = formatter.format(journey, [
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
      _forge: StructureType.JOURNEY,
      code: 'travel-declaration',
      path: '/travel-declaration',
      title: 'Travel declaration',
      steps: [
        {
          _forge: StructureType.STEP,
          path: '/trips',
          title: 'Trips',
          blocks: [
            {
              _forge: ComponentCallType.FIELD,
              variant: 'GovUKInput',
              code: 'departure',
              validWhen: [
                {
                  _forge: PolicyType.VALIDATION_RULE,
                  message: 'Enter a departure date',
                  condition: {
                    _forge: PredicateType.TEST,
                    subject: { _forge: ExpressionType.REFERENCE, path: ['answers', 'departure'] },
                    condition: {
                      _forge: FunctionCallType.CONDITION,
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
    const result = formatter.format(journey, [
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
