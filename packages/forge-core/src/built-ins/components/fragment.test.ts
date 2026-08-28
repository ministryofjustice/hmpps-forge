import { Fragment } from './fragment'
import type { EvaluatedBlock } from '../../components/types/structures.type'
import { ComponentCallType } from '../../shared/taxonomy'

const renderedBlock = (variant: string, html: string) => ({
  block: { _forge: ComponentCallType.BASIC, variant },
  html,
})

const render = (blocks: unknown[]) =>
  Fragment.render({
    _forge: ComponentCallType.BASIC,
    variant: 'fragment',
    blocks,
  } as unknown as EvaluatedBlock<Fragment>)

describe('fragment component', () => {
  it('should stamp the fragment variant when called as a builder', () => {
    const built = Fragment({ blocks: [] })

    expect(built.variant).toBe('fragment')
  })

  it('should concatenate child block HTML with no wrapper element', () => {
    const result = render([
      renderedBlock('heading', '<h3 class="govuk-heading-s">Title</h3>'),
      renderedBlock('body', '<p class="govuk-body">Body</p>'),
    ])

    expect(result).toBe('<h3 class="govuk-heading-s">Title</h3><p class="govuk-body">Body</p>')
  })

  it('should render an empty string for no blocks', () => {
    expect(render([])).toBe('')
  })

  it('should skip non-block children', () => {
    const result = render(['a string', renderedBlock('body', '<p>Body</p>'), null, undefined])

    expect(result).toBe('<p>Body</p>')
  })

  it('should flatten nested arrays of children in order', () => {
    const result = render([
      [renderedBlock('body', '<p>One</p>'), renderedBlock('body', '<p>Two</p>')],
      renderedBlock('body', '<p>Three</p>'),
    ])

    expect(result).toBe('<p>One</p><p>Two</p><p>Three</p>')
  })

})
