import { Forge } from '@ministryofjustice/hmpps-forge/core'
import type { LlmSupplier } from '@ministryofjustice/hmpps-forge/llm-adapter'
import { llmDemoPackage } from '@ministryofjustice/hmpps-forge/llm-adapter/demo'

import { LlmWebchat } from './LlmWebchat'
import type { LlmWebchatHostSession } from './LlmWebchatSessionStore'

describe('LlmWebchat', () => {
  const now = () => new Date('2026-09-01T09:30:00.000Z')
  let nextId: number
  let createId: () => string
  let hostSession: LlmWebchatHostSession
  let forge: Forge

  beforeEach(() => {
    nextId = 0
    createId = () => {
      nextId += 1

      return `webchat-id-${nextId}`
    }
    hostSession = {}
    forge = new Forge({
      logger: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      },
    }).registerPackage(llmDemoPackage)
  })

  describe('start()', () => {
    it('should start one persisted conversation when the web session is new', async () => {
      // Arrange
      const supplier: LlmSupplier = { resolveTurn: vi.fn() }
      const webchat = new LlmWebchat(
        forge,
        supplier,
        hostSession,
        'http://localhost:3000',
        now,
        createId,
      )

      // Act
      const firstView = await webchat.start()
      const secondView = await webchat.start()

      // Assert
      expect(firstView).toEqual(secondView)
      expect(firstView.status).toBe('awaiting-input')
      expect(firstView.messages).toEqual([
        {
          id: 'webchat-id-2',
          text: expect.stringContaining('tell me about the place you currently call home'),
          html: expect.stringContaining('<p>To get us started'),
          type: 'received',
          sender: 'Forge assistant',
          timestamp: '2026-09-01T09:30:00.000Z',
        },
      ])
      expect(hostSession.llmWebchat?.conversationId).toBe('webchat-id-1')
      expect(hostSession.llmWebchat?.adapterSession).toBeDefined()
      expect(supplier.resolveTurn).not.toHaveBeenCalled()
    })
  })

  describe('respond()', () => {
    it('should reload adapter state from the web session and retain the transcript', async () => {
      // Arrange
      const supplier: LlmSupplier = {
        resolveTurn: vi
          .fn()
          .mockResolvedValueOnce({ answers: { housingSituation: 'renter' } })
          .mockResolvedValueOnce({ answers: {} }),
      }
      const firstRequest = new LlmWebchat(
        forge,
        supplier,
        hostSession,
        'http://localhost:3000',
        now,
        createId,
      )

      await firstRequest.start()

      const reloadedHostSession = structuredClone(hostSession)
      const secondRequest = new LlmWebchat(
        forge,
        supplier,
        reloadedHostSession,
        'http://localhost:3000',
        now,
        createId,
      )

      // Act
      const update = await secondRequest.respond('I rent a flat in Leeds')

      // Assert
      expect(update.status).toBe('awaiting-input')
      expect(update.messages).toHaveLength(3)
      expect(update.messages[1]).toMatchObject({
        text: 'I rent a flat in Leeds',
        type: 'sent',
        sender: 'You',
      })
      expect(update.assistantMessage?.text).toContain('Tell me what kind of property you rent')
      expect(reloadedHostSession.llmWebchat?.adapterSession?.currentPath).toBe(
        '/llm-demo/renter-details',
      )
      expect(reloadedHostSession.llmWebchat?.adapterSession?.requestSession).toMatchObject({
        answers: { housingSituation: 'renter' },
      })
    })

    it('should render assistant Markdown without trusting answer content as HTML', async () => {
      // Arrange
      const supplier: LlmSupplier = {
        resolveTurn: vi
          .fn()
          .mockResolvedValueOnce({ answers: { housingSituation: 'family-or-friends' } })
          .mockResolvedValueOnce({
            answers: {
              sharedHomeWith: 'friends',
              sharedHomeMoveInDate: '23/04/2023',
              sharedHomeExperience:
                '![tracking](https://example.com/tracking.png) <img src=x onerror=alert(1)>',
              sharedHomePlans: 'move',
            },
          })
          .mockResolvedValueOnce({
            answers: {
              housingPriorities: ['space', 'outdoor-space', 'public-transport'],
              idealHomeDescription: 'A house with a garden',
              movingTimeframe: 'one-to-three-years',
            },
          }),
      }
      const webchat = new LlmWebchat(
        forge,
        supplier,
        hostSession,
        'http://localhost:3000',
        now,
        createId,
      )

      await webchat.start()

      // Act
      const update = await webchat.respond('Here is everything about my housing situation')

      // Assert
      expect(update.assistantMessage?.html).toContain(
        '<strong>Shared-home experience:</strong> tracking &lt;img src=x onerror=alert(1)&gt;',
      )
      expect(update.assistantMessage?.html).not.toContain(
        '<strong>Does that summary look correct? If not, tell me what needs changing.</strong>',
      )
      expect(update.assistantMessage?.html?.match(/llm-webchat__content-rule/g)).toHaveLength(2)
      expect(update.assistantMessage?.html).not.toContain('<img')
      expect(update.assistantMessage?.html).not.toContain('tracking.png')
      expect(update.assistantMessage?.text).toContain(
        '**Shared home with:** Friends\n\n**Started living there:** 23 April 2023',
      )
      expect(update.assistantMessage?.text).not.toContain('- Shared home with')
    })
  })

  describe('reset()', () => {
    it('should remove the server-side conversation state', async () => {
      // Arrange
      const supplier: LlmSupplier = { resolveTurn: vi.fn() }
      const webchat = new LlmWebchat(
        forge,
        supplier,
        hostSession,
        'http://localhost:3000',
        now,
        createId,
      )

      await webchat.start()

      // Act
      await webchat.reset()

      // Assert
      expect(hostSession.llmWebchat).toBeUndefined()
    })
  })
})
