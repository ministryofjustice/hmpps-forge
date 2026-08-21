import { describe, expect, it } from 'vitest'
import {
  FunctionRegistryTestHarness,
  createTestEffectContext,
} from '@ministryofjustice/hmpps-forge/core/testing'
import { PatternEffects } from './effects'
import type { PatternSession } from './context.type'

const harness = new FunctionRegistryTestHarness([
  PatternEffects.AddRepeatingItem,
  PatternEffects.SaveRepeatingItems,
])

describe('PatternEffects', () => {
  describe('AddRepeatingItem()', () => {
    it('should append a new row from live context data when no draft collection exists yet', () => {
      // Arrange
      const effectContext = createTestEffectContext({
        session: {},
        data: {
          members: [{ memberName: '', memberAge: '' }],
        },
        answers: {
          memberName_0: 'Alice',
          memberAge_0: '10',
        },
      })

      // Act
      harness
        .evaluate(
          PatternEffects.AddRepeatingItem('repeating-fieldsets', 'members', [
            'memberName',
            'memberAge',
          ]),
        )
        .withContext(effectContext)

      // Assert
      const session = effectContext.getSession() as PatternSession
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
      const effectContext = createTestEffectContext({
        session: {},
        data: {
          members: [{ memberName: '', memberAge: '' }],
        },
        answers: {
          memberName_0: 'Alice',
          memberAge_0: '10',
        },
      })

      // Act
      harness
        .evaluate(
          PatternEffects.SaveRepeatingItems('repeating-fieldsets', 'members', [
            'memberName',
            'memberAge',
          ]),
        )
        .withContext(effectContext)

      // Assert
      const session = effectContext.getSession() as PatternSession
      expect(session.patternDrafts?.['repeating-fieldsets']).toEqual({
        members: [{ memberName: 'Alice', memberAge: '10' }],
      })
    })
  })
})
