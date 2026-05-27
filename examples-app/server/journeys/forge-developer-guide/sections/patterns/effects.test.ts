import type { GuideDeps } from '../../effects'
import { PatternEffectsImplementations } from './effects'
import type { PatternEffectContext, PatternSession } from './context.type'
import { describe, expect, it } from "vitest"

const deps = {
  guideContentStore: {
    load: async () => {},
    getMarkdown: (): undefined => undefined,
    getHeadings: (): never[] => [],
  },
  guideSearch: {
    search: async (): Promise<never[]> => [],
  },
  formDataStore: {
    get: async (): Promise<null> => null,
    set: async () => {},
    delete: async () => {},
  },
  mocksApi: {
    lookupAddress: async () => ({
      line1: '',
      line2: '',
      town: '',
      county: '',
      postcode: '',
    }),
    getLotteryBalls: async () => ({
      balls: [1, 2, 3, 4, 5, 6],
      bonusBall: 7,
      drawDate: 'Tuesday 21 April 2026',
    }),
  },
} as unknown as GuideDeps

function createPatternEffectContext(options: {
  answers?: Record<string, unknown>
  data?: Record<string, unknown>
  post?: Record<string, string>
  session?: PatternSession
}): PatternEffectContext {
  const answers = { ...(options.answers ?? {}) }
  const data = { ...(options.data ?? {}) }
  const post = { ...(options.post ?? {}) }

  const context = {
    getSession: () => options.session,
    getAnswer: (key: string) => answers[key],
    setAnswer: (key: string, value: unknown) => {
      answers[key] = value
    },
    getData: (key: string) => data[key],
    setData: (key: string, value: unknown) => {
      data[key] = value
    },
    getPostData: (key?: string) => {
      if (key === undefined) {
        return { ...post }
      }

      return post[key]
    },
  } satisfies Pick<
    PatternEffectContext,
    'getSession' | 'getAnswer' | 'setAnswer' | 'getData' | 'setData' | 'getPostData'
  >

  return context as PatternEffectContext
}

describe('PatternEffectsImplementations', () => {
  describe('AddRepeatingItem()', () => {
    it('should append a new row from live context data when no draft collection exists yet', () => {
      // Arrange
      const session = {} as PatternSession
      const effectContext = createPatternEffectContext({
        session,
        data: {
          members: [{ memberName: '', memberAge: '' }],
        },
        answers: {
          memberName_0: 'Alice',
          memberAge_0: '10',
        },
      })
      const addRepeatingItem = PatternEffectsImplementations.AddRepeatingItem(deps)

      // Act
      addRepeatingItem(effectContext, 'repeating-fieldsets', 'members', ['memberName', 'memberAge'])

      // Assert
      expect(session.patternDrafts?.['repeating-fieldsets']).toEqual({
        members: [
          { memberName: 'Alice', memberAge: '10' },
          { memberName: '', memberAge: '' },
        ],
      })
      expect(effectContext.getData('members')).toEqual([
        { memberName: 'Alice', memberAge: '10' },
        { memberName: '', memberAge: '' },
      ])
      expect(effectContext.getAnswer('memberName_1')).toBe('')
      expect(effectContext.getAnswer('memberAge_1')).toBe('')
    })
  })

  describe('SaveRepeatingItems()', () => {
    it('should persist the current rows from live context data when saving for the first time', () => {
      // Arrange
      const session = {} as PatternSession
      const effectContext = createPatternEffectContext({
        session,
        data: {
          members: [{ memberName: '', memberAge: '' }],
        },
        answers: {
          memberName_0: 'Alice',
          memberAge_0: '10',
        },
      })
      const saveRepeatingItems = PatternEffectsImplementations.SaveRepeatingItems(deps)

      // Act
      saveRepeatingItems(effectContext, 'repeating-fieldsets', 'members', [
        'memberName',
        'memberAge',
      ])

      // Assert
      expect(session.patternDrafts?.['repeating-fieldsets']).toEqual({
        members: [{ memberName: 'Alice', memberAge: '10' }],
      })
    })
  })
})
