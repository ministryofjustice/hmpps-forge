import { describe, expect, it } from 'vitest'
import { BlockType } from '../../src/authoring/types/enums'
import type { RenderBlock } from '../../src/framework/types/rendering.type'
import { createClient, createTracedClient, answerOf, type ContractSession } from './contractHelpers'
import type { RequestTraceEvent } from '../../src/testing'
import {
  basicBlocksJourney,
  blockOrderingJourney,
  visibleWhenFalseJourney,
  visibleWhenDynamicJourney,
  visibleWhenPreservesAnswerJourney,
  dynamicPropertyJourney,
  stepMetadataJourney,
  answerDisplayJourney,
  matchCombinatorJourney,
  validationDisplayJourney,
  iteratorRenderJourney,
  dataDisplayJourney,
  domainValidationRenderJourney,
  backlinkJourney,
  ancestorJourney,
  autoDerivedBacklinkJourney,
  stepViewJourney,
  inheritedViewJourney,
  blockSkipPropsJourney,
  routeTreeJourney,
  parsedValueRenderJourney,
  postBlockValueAfterDependentWhenJourney,
  nestedBlockValidationJourney,
  transformerOverUnansweredJourney,
} from './resolve.fixtures'

function iteratorBlocks(blocks: RenderBlock[]): RenderBlock[] {
  const collectionBlock = blocks.find(b => b.variant === 'collection-block')
  const collection = collectionBlock?.properties.collection as RenderBlock[][] | undefined

  return collection?.flat() ?? []
}

describe('resolve contracts', () => {
  describe('block evaluation', () => {
    it('should render field blocks with correct variant and blockType', async () => {
      // Arrange
      const client = createClient(basicBlocksJourney)

      // Act
      const result = await client.get('/basic-blocks/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const textInputs = result.getBlocksByVariant('govukTextInput')

        expect(textInputs).toHaveLength(1)
        expect(textInputs[0].blockType).toBe(BlockType.FIELD)
        expect(textInputs[0].properties.code).toBe('fullName')
        expect(textInputs[0].properties.label).toBe('Full name')
      }
    })

    it('should render basic blocks with correct variant and blockType', async () => {
      // Arrange
      const client = createClient(basicBlocksJourney)

      // Act
      const result = await client.get('/basic-blocks/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const buttons = result.getBlocksByVariant('govukButton')

        expect(buttons).toHaveLength(1)
        expect(buttons[0].blockType).toBe(BlockType.BASIC)
        expect(buttons[0].properties.text).toBe('Continue')
      }
    })

    it('should preserve authored block ordering', async () => {
      // Arrange
      const client = createClient(blockOrderingJourney)

      // Act
      const result = await client.get('/ordering/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const fieldBlocks = result.context.blocks.filter(b => b.blockType === BlockType.FIELD)
        const codes = fieldBlocks.map(b => b.properties.code)

        expect(codes).toEqual(['firstName', 'lastName', 'email'])
      }
    })

    it('should emit render work units to trace observer', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(basicBlocksJourney, traces)

      // Act
      await client.get('/basic-blocks/form', { session: {} })

      // Assert
      expect(traces).toHaveLength(1)
      expect(traces[0].trace.phases).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            phase: 'access',
            units: expect.arrayContaining([
              expect.objectContaining({
                kind: 'access.lifecycle',
              }),
            ]),
          }),
          expect.objectContaining({
            phase: 'answer-preparation',
            units: expect.arrayContaining([
              expect.objectContaining({
                kind: 'answer.preparation',
              }),
            ]),
          }),
          expect.objectContaining({
            phase: 'reachability',
            units: expect.arrayContaining([
              expect.objectContaining({
                key: 'after-reachability',
                kind: 'context-snapshot',
              }),
            ]),
          }),
          expect.objectContaining({
            phase: 'answer-cleardown',
            units: expect.arrayContaining([
              expect.objectContaining({
                key: 'after-answer-cleardown',
                kind: 'context-snapshot',
              }),
            ]),
          }),
          expect.objectContaining({
            phase: 'entry-validation',
            units: expect.arrayContaining([
              expect.objectContaining({
                key: 'after-entry-validation',
                kind: 'context-snapshot',
              }),
            ]),
          }),
          expect.objectContaining({
            phase: 'resolve',
            units: expect.arrayContaining([
              expect.objectContaining({
                kind: 'resolve.blocks',
                children: expect.arrayContaining([
                  expect.objectContaining({
                    kind: 'resolve.block',
                    beginFields: expect.objectContaining({ variant: 'govukTextInput' }),
                  }),
                  expect.objectContaining({
                    kind: 'resolve.block',
                    beginFields: expect.objectContaining({ variant: 'govukButton' }),
                  }),
                ]),
              }),
            ]),
          }),
        ]),
      )
    })
  })

  describe('dynamic properties', () => {
    it('should resolve Data() references in block properties', async () => {
      // Arrange
      const client = createClient(dynamicPropertyJourney)
      const session: ContractSession = {
        data: { message: 'Important notice' },
      }

      // Act
      const result = await client.get('/dynamic-prop/info', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const insetBlocks = result.getBlocksByVariant('govukInsetText')

        expect(insetBlocks).toHaveLength(1)
        expect(insetBlocks[0].properties.text).toBe('Important notice')
      }
    })

    it('should resolve Format() expressions in iterator block labels', async () => {
      // Arrange
      const client = createClient(iteratorRenderJourney)
      const session: ContractSession = {
        data: { members: [{ name: 'Ada' }, { name: 'Grace' }] },
      }

      // Act
      const result = await client.get('/iter-render/members', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const expanded = iteratorBlocks(result.context.blocks)

        expect(expanded[0].properties.label).toBe('Member 1 name')
        expect(expanded[1].properties.label).toBe('Member 2 name')
      }
    })

    it('should resolve a transformer prop to undefined when the piped answer is unanswered', async () => {
      // Arrange
      const client = createClient(transformerOverUnansweredJourney)

      // Act
      const result = await client.get('/transformer-unanswered/info', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const insetBlocks = result.getBlocksByVariant('govukInsetText')

        expect(insetBlocks).toHaveLength(1)
        expect(insetBlocks[0].properties.text).toBeUndefined()
      }
    })
  })

  describe('match expressions', () => {
    it('should resolve the branch value when a nested combinator condition matches', async () => {
      // Arrange
      const client = createClient(matchCombinatorJourney)
      const session: ContractSession = {
        answers: { 'match-combinator': { referenceCode: 'FT12' } },
      }

      // Act
      const result = await client.get('/match-combinator/summary', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const insetBlocks = result.getBlocksByVariant('govukInsetText')

        expect(insetBlocks[0].properties.text).toBe('Fast track referral')
      }
    })

    it('should resolve the branch value when a plain single condition matches', async () => {
      // Arrange
      const client = createClient(matchCombinatorJourney)
      const session: ContractSession = {
        answers: { 'match-combinator': { referenceCode: 'SR-1234' } },
      }

      // Act
      const result = await client.get('/match-combinator/summary', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const insetBlocks = result.getBlocksByVariant('govukInsetText')

        expect(insetBlocks[0].properties.text).toBe('Standard referral')
      }
    })

    it('should resolve the otherwise value when no branch condition matches', async () => {
      // Arrange
      const client = createClient(matchCombinatorJourney)
      const session: ContractSession = {
        answers: { 'match-combinator': { referenceCode: 'SR-12' } },
      }

      // Act
      const result = await client.get('/match-combinator/summary', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const insetBlocks = result.getBlocksByVariant('govukInsetText')

        expect(insetBlocks[0].properties.text).toBe('Unrecognised referral')
      }
    })

    it('should resolve the first matching branch when an answer satisfies both branches', async () => {
      // Arrange
      const client = createClient(matchCombinatorJourney)
      const session: ContractSession = {
        answers: { 'match-combinator': { referenceCode: 'FT123456' } },
      }

      // Act
      const result = await client.get('/match-combinator/summary', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const insetBlocks = result.getBlocksByVariant('govukInsetText')

        expect(insetBlocks[0].properties.text).toBe('Fast track referral')
      }
    })
  })

  describe('visibleWhen', () => {
    it('should mark block as hidden when visibleWhen is false', async () => {
      // Arrange
      const client = createClient(visibleWhenFalseJourney)

      // Act
      const result = await client.get('/visible-false/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const hiddenBlock = result.context.blocks.find(b => b.properties.code === 'hidden')
        const shownBlock = result.context.blocks.find(b => b.properties.code === 'shown')

        expect(hiddenBlock?.properties.visibleWhen).toBe(false)
        expect(shownBlock?.properties.visibleWhen).not.toBe(false)
      }
    })

    it('should mark block as visible when dynamic condition is met', async () => {
      // Arrange
      const client = createClient(visibleWhenDynamicJourney)
      const session: ContractSession = {
        answers: { 'visible-dynamic': { contactMethod: 'email' } },
      }

      // Act
      const result = await client.get('/visible-dynamic/contact', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const emailBlock = result.context.blocks.find(b => b.properties.code === 'emailAddress')

        expect(emailBlock).toBeDefined()
        expect(emailBlock?.properties.visibleWhen).not.toBe(false)
      }
    })

    it('should mark block as hidden when dynamic condition is not met', async () => {
      // Arrange
      const client = createClient(visibleWhenDynamicJourney)
      const session: ContractSession = {
        answers: { 'visible-dynamic': { contactMethod: 'phone' } },
      }

      // Act
      const result = await client.get('/visible-dynamic/contact', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const emailBlock = result.context.blocks.find(b => b.properties.code === 'emailAddress')

        expect(emailBlock?.properties.visibleWhen).toBe(false)
      }
    })

    it('should not clear answers for fields hidden by visibleWhen', async () => {
      // Arrange
      const client = createClient(visibleWhenPreservesAnswerJourney)
      const session: ContractSession = {
        answers: { 'visible-preserves': { toggle: 'no', detail: 'some value' } },
      }

      // Act
      const result = await client.get('/visible-preserves/form', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const detailBlock = result.context.blocks.find(b => b.properties.code === 'detail')

        expect(detailBlock?.properties.visibleWhen).toBe(false)
        expect(answerOf(result.context.answers, 'detail').current).toBe('some value')
      }
    })
  })

  describe('iterator rendering', () => {
    it('should expand blocks per collection item', async () => {
      // Arrange
      const client = createClient(iteratorRenderJourney)
      const session: ContractSession = {
        data: { members: [{ name: 'Ada' }, { name: 'Grace' }, { name: 'Linus' }] },
      }

      // Act
      const result = await client.get('/iter-render/members', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const expanded = iteratorBlocks(result.context.blocks)

        expect(expanded).toHaveLength(3)
        expect(expanded.every(b => b.variant === 'govukTextInput')).toBe(true)
      }
    })

    it('should render no expanded blocks when collection is empty', async () => {
      // Arrange
      const client = createClient(iteratorRenderJourney)
      const session: ContractSession = {
        data: { members: [] },
      }

      // Act
      const result = await client.get('/iter-render/members', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const expanded = iteratorBlocks(result.context.blocks)

        expect(expanded).toHaveLength(0)
      }
    })

    it('should resolve per-item field codes in expanded blocks', async () => {
      // Arrange
      const client = createClient(iteratorRenderJourney)
      const session: ContractSession = {
        data: { members: [{ name: 'Ada' }, { name: 'Grace' }] },
      }

      // Act
      const result = await client.get('/iter-render/members', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const expanded = iteratorBlocks(result.context.blocks)
        const codes = expanded.map(b => b.properties.code)

        expect(codes).toEqual(['memberName_0', 'memberName_1'])
      }
    })
  })

  describe('step context', () => {
    it('should expose step title in render context', async () => {
      // Arrange
      const client = createClient(stepMetadataJourney)

      // Act
      const result = await client.get('/step-meta/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.step.title).toBe('Step Title')
      }
    })

    it('should expose custom step metadata in render context', async () => {
      // Arrange
      const client = createClient(stepMetadataJourney)

      // Act
      const result = await client.get('/step-meta/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.step.metadata).toEqual({ section: 'personal-details' })
        expect(result.context.step).not.toHaveProperty('onAccess')
        expect(result.context.step).not.toHaveProperty('onSubmission')
        expect(result.context.step).not.toHaveProperty('blocks')
        expect(result.context.step).not.toHaveProperty('reachability')
      }
    })

    it('should include stored answers in render context on GET', async () => {
      // Arrange
      const client = createClient(answerDisplayJourney)
      const session: ContractSession = {
        answers: { 'answer-display': { fullName: 'Ada Lovelace' } },
      }

      // Act
      const result = await client.get('/answer-display/name', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(answerOf(result.context.answers, 'fullName').current).toBe('Ada Lovelace')
      }
    })

    it('should include loaded data in render context on GET', async () => {
      // Arrange
      const client = createClient(dataDisplayJourney)
      const session: ContractSession = {
        data: { userName: 'Ada Lovelace' },
      }

      // Act
      const result = await client.get('/data-display/info', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.userName).toBe('Ada Lovelace')
      }
    })

    it('should include explicit backlink in step context', async () => {
      // Arrange
      const client = createClient(backlinkJourney)

      // Act
      const result = await client.get('/backlink/step-two', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.step.backlink).toBe('/backlink/step-one')
      }
    })

    it('should auto-derive backlink from navigation when step has no explicit backlink', async () => {
      // Arrange
      const client = createClient(autoDerivedBacklinkJourney)
      const session: ContractSession = {
        answers: { 'auto-backlink': { firstName: 'Ada' } },
      }

      // Act
      const result = await client.get('/auto-backlink/step-two', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.step.backlink).toBe('/auto-backlink/step-one')
      }
    })

    it('should include journey ancestors in render context', async () => {
      // Arrange
      const client = createClient(ancestorJourney)

      // Act
      const result = await client.get('/parent/child/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.ancestors).toHaveLength(2)
        expect(result.context.ancestors[0]).toEqual(
          expect.objectContaining({
            code: 'parent',
            title: 'Parent Journey',
          }),
        )
        expect(result.context.ancestors[1]).toEqual(
          expect.objectContaining({
            code: 'child',
            title: 'Child Journey',
          }),
        )
      }
    })

    it('should compose ancestor paths cumulatively from root to child', async () => {
      // Arrange
      const client = createClient(ancestorJourney)

      // Act
      const result = await client.get('/parent/child/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.ancestors).toHaveLength(2)
        expect(result.context.ancestors[0].path).toBe('/parent')
        expect(result.context.ancestors[1].path).toBe('/parent/child')
      }
    })

    it('should pass through ancestor metadata into render context', async () => {
      // Arrange
      const client = createClient(ancestorJourney)

      // Act
      const result = await client.get('/parent/child/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.ancestors[0].metadata).toEqual({ section: 'top-level' })
      }
    })

    it('should pass through step view config into render context', async () => {
      // Arrange
      const client = createClient(stepViewJourney)

      // Act
      const result = await client.get('/step-view/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.step.view).toEqual({
          template: 'custom-layout.njk',
          locals: { sidebar: 'enabled' },
        })
      }
    })

    it('should resolve the effective view when ancestors and the step declare view config', async () => {
      // Arrange
      const client = createClient(inheritedViewJourney)

      // Act
      const result = await client.get('/inherited-view/child/step-view', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.step.view).toEqual({
          template: 'step-layout',
          locals: {
            rootOnly: 'root',
            childOnly: 'child',
            stepOnly: 'step',
            shared: 'step',
            resolvedLabel: 'resolved',
          },
        })
        expect(result.context.ancestors.map(ancestor => ancestor.view)).toEqual([
          {
            template: 'root-layout',
            locals: { rootOnly: 'root', shared: 'root' },
          },
          {
            template: 'child-layout',
            locals: { childOnly: 'child', shared: 'child' },
          },
        ])
      }
    })

    it('should resolve an effective view when only ancestors declare view config', async () => {
      // Arrange
      const client = createClient(inheritedViewJourney)

      // Act
      const result = await client.get('/inherited-view/child/ancestor-view', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.step.view).toEqual({
          template: 'child-layout',
          locals: {
            rootOnly: 'root',
            childOnly: 'child',
            shared: 'child',
          },
        })
      }
    })

    it('should leave the step view undefined when the step and its ancestors omit view config', async () => {
      // Arrange
      const client = createClient(ancestorJourney)

      // Act
      const result = await client.get('/parent/child/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.step.view).toBeUndefined()
      }
    })

    it('should strip BLOCK_SKIP_PROPS from rendered block properties', async () => {
      // Arrange
      const client = createClient(blockSkipPropsJourney)

      // Act
      const result = await client.get('/block-skip/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const fieldBlock = result.context.blocks.find(b => b.properties.code === 'trimmedField')

        expect(fieldBlock).toBeDefined()
        expect(fieldBlock?.properties).not.toHaveProperty('formatters')
        expect(fieldBlock?.properties).not.toHaveProperty('parsers')
        expect(fieldBlock?.properties).not.toHaveProperty('validWhen')
        expect(fieldBlock?.properties).not.toHaveProperty('dependentWhen')
      }
    })

    it('should use parsed value as block value on GET when field has parsers', async () => {
      // Arrange
      const client = createClient(parsedValueRenderJourney)
      const session: ContractSession = {
        answers: { 'parsed-render': { fullName: 'ada lovelace' } },
      }

      // Act
      const result = await client.get('/parsed-render/name', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const nameBlock = result.context.blocks.find(b => b.properties.code === 'fullName')

        expect(nameBlock).toBeDefined()
        expect(nameBlock?.properties.value).toBe('ADA LOVELACE')
      }
    })

    it('should use current value after non-processed mutation on POST render', async () => {
      // Arrange
      const client = createClient(postBlockValueAfterDependentWhenJourney)

      // Act
      const result = await client.post('/post-block-dw/form', {
        session: {},
        body: { contactMethod: 'phone', emailAddress: 'test@example.com', fullName: '' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)

        const emailBlock = result.context.blocks.find(b => b.properties.code === 'emailAddress')

        expect(emailBlock).toBeDefined()
        expect(emailBlock?.properties.value).toBeUndefined()
      }
    })

    it('should expose routeTree with resolved paths and active state', async () => {
      // Arrange
      const client = createClient(routeTreeJourney)

      // Act
      const result = await client.get('/route-tree/step-one', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const routeTree = result.context.routeTree

        expect(routeTree).toBeDefined()
        expect(routeTree.length).toBeGreaterThan(0)

        const journeyNode = routeTree.find(n => n.segment === 'route-tree')

        expect(journeyNode).toBeDefined()

        if (journeyNode) {
          expect(journeyNode.path).toBe('/route-tree')
          expect(journeyNode.active).toBe(true)

          const stepOneNode = journeyNode.children.find(n => n.segment === 'step-one')
          const stepTwoNode = journeyNode.children.find(n => n.segment === 'step-two')

          expect(stepOneNode).toBeDefined()
          expect(stepOneNode?.active).toBe(true)
          expect(stepOneNode?.path).toBe('/route-tree/step-one')

          expect(stepTwoNode).toBeDefined()
          expect(stepTwoNode?.active).toBe(false)
          expect(stepTwoNode?.path).toBe('/route-tree/step-two')
        }
      }
    })
  })

  describe('validation display', () => {
    it('should attach validation errors to blocks on failed POST', async () => {
      // Arrange
      const client = createClient(validationDisplayJourney)

      // Act
      const result = await client.post('/validation-display/form', {
        session: {},
        body: { fullName: '', email: '' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)

        const nameErrors = result.getValidationErrorsByFieldCode('fullName')
        const emailErrors = result.getValidationErrorsByFieldCode('email')

        expect(nameErrors).toHaveLength(1)
        expect(nameErrors[0].message).toBe('Enter your full name')
        expect(emailErrors).toHaveLength(1)
        expect(emailErrors[0].message).toBe('Enter your email')
      }
    })

    it('should not show validation errors on initial GET', async () => {
      // Arrange
      const client = createClient(validationDisplayJourney)

      // Act
      const result = await client.get('/validation-display/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(false)
        expect(result.context.fieldValidationErrors).toHaveLength(0)
      }
    })

    it('should include domain validation errors in render context', async () => {
      // Arrange
      const client = createClient(domainValidationRenderJourney)

      // Act
      const result = await client.post('/domain-render/range', {
        session: {},
        body: { minValue: '10', maxValue: '10' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)
        expect(result.context.domainValidationErrors).toEqual([
          expect.objectContaining({ message: 'Minimum and maximum must be different' }),
        ])
        expect(result.context.fieldValidationErrors).toHaveLength(0)
      }
    })

    it('should attach validation results to block properties', async () => {
      // Arrange
      const client = createClient(validationDisplayJourney)

      // Act
      const result = await client.post('/validation-display/form', {
        session: {},
        body: { fullName: '', email: 'ada@example.com' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const nameBlock = result.context.blocks.find(b => b.properties.code === 'fullName')
        const emailBlock = result.context.blocks.find(b => b.properties.code === 'email')
        const nameErrors = nameBlock?.properties.errors as { passed: boolean; message: string }[]
        const emailErrors = emailBlock?.properties.errors as { passed: boolean; message: string }[]

        expect(nameErrors.some(v => !v.passed && v.message === 'Enter your full name')).toBe(true)
        expect(emailErrors).toEqual([])

        expect(nameBlock?.properties.value).toBe('')
        expect(emailBlock?.properties.value).toBe('ada@example.com')
      }
    })

    it('should attach validation errors to nested blocks inside radio conditional reveal', async () => {
      // Arrange
      const client = createClient(nestedBlockValidationJourney)

      // Act
      const result = await client.post('/nested-valid/form', {
        session: {},
        body: { choice: 'yes' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)

        const detailErrors = result.getValidationErrorsByFieldCode('detail')

        expect(detailErrors).toHaveLength(1)
        expect(detailErrors[0].message).toBe('Enter a detail')

        const radioBlock = result.context.blocks.find(b => b.properties.code === 'choice')
        const items = radioBlock?.properties.items as { value: string; block?: RenderBlock }[]
        const nestedBlock = items?.find(i => i.value === 'yes')?.block

        expect(nestedBlock).toBeDefined()

        const nestedErrors = nestedBlock?.properties.errors as { passed: boolean; message: string }[]

        expect(nestedErrors).toBeDefined()
        expect(nestedErrors.some(v => !v.passed && v.message === 'Enter a detail')).toBe(true)
      }
    })
  })
})
