import { block, journey, step } from '../../../../src/authoring'
import { component, type BlockDefinition, type FieldBlockDefinition } from '../../../../src/components'

interface ContractField {
  label: string
}

interface RenderContractDependencies {
  readonly renderProbe?: (variant: string) => void
}

type ContractAsyncField = object

interface ContractNestedFieldProbe {
  field: FieldBlockDefinition
}

interface ContractMultiFieldProbe {
  fields: FieldBlockDefinition[]
}

interface ContractScopedHtml {
  content: string
}

const ContractField = component<ContractField, RenderContractDependencies>('contractField', {
  field: true,
  factory: dependencies => props => {
    dependencies.renderProbe?.('contractField')

    return `<input id="${props.code}" name="${props.code}" aria-label="${props.label}">`
  },
})

const ContractAsyncField = component<ContractAsyncField>('contractAsyncField', {
  field: true,
  factory: () => props => Promise.resolve(`<async id="${props.code}">`),
})

const ContractNestedFieldProbe = component<ContractNestedFieldProbe>('contractNestedFieldProbe', {
  factory: () => props => {
    const nestedFieldBlock = props.field.block as FieldBlockDefinition

    return `<div data-nested-field-code="${nestedFieldBlock.code}">${props.field.html}</div>`
  },
})

const ContractMultiFieldProbe = component<ContractMultiFieldProbe>('contractMultiFieldProbe', {
  factory: () => props => {
    const inner = props.fields.map(nested => nested.html).join('')

    return `<section>${inner}</section>`
  },
})

/** Package-scope entry claiming the built-in `html` variant - the scoped entry must win for its own journey. */
export const contractScopedHtmlComponent = component<ContractScopedHtml>('html', {
  factory: () => props => `<scoped>${props.content}</scoped>`,
})

export const renderContractComponents = [
  ContractField,
  ContractAsyncField,
  ContractNestedFieldProbe,
  ContractMultiFieldProbe,
]

export const basicRenderJourney = journey({
  code: 'basic-render',
  path: '/basic-render',
  title: 'Basic Render',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [ContractField({ code: 'fullName', label: 'Full name' })],
    }),
  ],
})

export const orderedRenderJourney = journey({
  code: 'ordered-render',
  path: '/ordered-render',
  title: 'Ordered Render',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        ContractField({ code: 'firstName', label: 'First name' }),
        ContractField({ code: 'lastName', label: 'Last name' }),
        ContractField({ code: 'email', label: 'Email' }),
      ],
    }),
  ],
})

export const invisibleBlockRenderJourney = journey({
  code: 'invisible-render',
  path: '/invisible-render',
  title: 'Invisible Render',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        ContractField({ code: 'shown', label: 'Shown field' }),
        ContractField({ code: 'hidden', label: 'Hidden field', visibleWhen: false }),
      ],
    }),
  ],
})

export const asyncRenderJourney = journey({
  code: 'async-render',
  path: '/async-render',
  title: 'Async Render',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [ContractAsyncField({ code: 'asyncField' }), ContractField({ code: 'syncField', label: 'Sync field' })],
    }),
  ],
})

export const nestedFieldMetadataRenderJourney = journey({
  code: 'nested-field-meta',
  path: '/nested-field-meta',
  title: 'Nested Field Metadata',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        ContractNestedFieldProbe({
          field: ContractField({ code: 'goal_title', label: 'Goal title' }),
        }),
      ],
    }),
  ],
})

export const multiNestedRenderJourney = journey({
  code: 'multi-nested-render',
  path: '/multi-nested-render',
  title: 'Multi Nested Render',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        ContractMultiFieldProbe({
          fields: [
            ContractField({ code: 'alpha', label: 'Alpha' }),
            ContractField({ code: 'bravo', label: 'Bravo' }),
            ContractField({ code: 'charlie', label: 'Charlie' }),
          ],
        }),
      ],
    }),
  ],
})

export const scopedOverrideRenderJourney = journey({
  code: 'scoped-override-render',
  path: '/scoped-override-render',
  title: 'Scoped Override Render',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [block<BlockDefinition & ContractScopedHtml>({ variant: 'html', content: 'shadowed' })],
    }),
  ],
})
