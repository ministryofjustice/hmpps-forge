import { Fragment } from './fragment'
import { component } from '../../components/component'
import { ComponentRegistryTestHarness } from '../../testing/components/ComponentRegistryTestHarness'

const TestBlock = component<{ html: string }>('testBlock', { render: props => props.html })

const harness = new ComponentRegistryTestHarness([Fragment, TestBlock])

const renderedBlock = (_variant: string, html: string) => TestBlock({ html })

const render = (blocks: ReturnType<typeof TestBlock>[]) => harness.render(Fragment({ blocks }))

describe('fragment component', () => {
  it('should stamp the fragment variant when called as a builder', () => {
    const built = Fragment({ blocks: [] })

    expect(built.variant).toBe('fragment')
  })

  it('should concatenate child block HTML with no wrapper element', async () => {
    const result = await render([
      renderedBlock('heading', '<h3 class="govuk-heading-s">Title</h3>'),
      renderedBlock('body', '<p class="govuk-body">Body</p>'),
    ])

    expect(result).toBe('<h3 class="govuk-heading-s">Title</h3><p class="govuk-body">Body</p>')
  })

  it('should render an empty string for no blocks', async () => {
    await expect(render([])).resolves.toBe('')
  })
})
