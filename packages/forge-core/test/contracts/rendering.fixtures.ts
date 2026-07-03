import { block as blockBuilder, field as fieldBuilder, journey, step } from '../../src/authoring'
import {
  buildComponent,
  type BlockDefinition,
  type FieldBlockDefinition,
  type RenderedBlock,
} from '../../src/components'

interface ContractField extends FieldBlockDefinition {
  variant: 'contractField'
  label: string
}

interface ContractAsyncField extends FieldBlockDefinition {
  variant: 'contractAsyncField'
}

interface ContractNestedFieldProbe extends BlockDefinition {
  variant: 'contractNestedFieldProbe'
  field: FieldBlockDefinition
}

interface ContractMultiFieldProbe extends BlockDefinition {
  variant: 'contractMultiFieldProbe'
  fields: FieldBlockDefinition[]
}

interface ContractScopedField extends FieldBlockDefinition {
  variant: 'contractScopedField'
}

const contractFieldComponent = buildComponent<ContractField>('contractField', block => {
  return `<input id="${block.code}" name="${block.code}" aria-label="${block.label}">`
})

const contractAsyncFieldComponent = buildComponent<ContractAsyncField>('contractAsyncField', block => {
  return Promise.resolve(`<async id="${block.code}">`)
})

const contractNestedFieldProbeComponent = buildComponent<ContractNestedFieldProbe>(
  'contractNestedFieldProbe',
  block => {
    const nestedField = block.field as RenderedBlock
    const nestedFieldBlock = nestedField.block as FieldBlockDefinition

    return `<div data-nested-field-code="${nestedFieldBlock.code}">${nestedField.html}</div>`
  },
)

const contractMultiFieldProbeComponent = buildComponent<ContractMultiFieldProbe>('contractMultiFieldProbe', block => {
  const nestedFields = block.fields as unknown as RenderedBlock[]
  const inner = nestedFields.map(nested => nested.html).join('')

  return `<section>${inner}</section>`
})

/** Global-scope entry for the shadowing test. Same variant as the package-scoped entry below. */
export const contractScopedGlobalComponent = buildComponent<ContractScopedField>('contractScopedField', block => {
  return `<global id="${block.code}">`
})

/** Package-scope entry that shadows the global one for the journey it is registered against. */
export const contractScopedPackageComponent = buildComponent<ContractScopedField>('contractScopedField', block => {
  return `<scoped id="${block.code}">`
})

function ContractField(props: Omit<ContractField, 'type' | 'blockType' | 'variant'>): ContractField {
  return fieldBuilder<ContractField>({ ...props, variant: 'contractField' })
}

function ContractAsyncField(props: Omit<ContractAsyncField, 'type' | 'blockType' | 'variant'>): ContractAsyncField {
  return fieldBuilder<ContractAsyncField>({ ...props, variant: 'contractAsyncField' })
}

function ContractNestedFieldProbe(
  props: Omit<ContractNestedFieldProbe, 'type' | 'blockType' | 'variant'>,
): ContractNestedFieldProbe {
  return blockBuilder<ContractNestedFieldProbe>({ ...props, variant: 'contractNestedFieldProbe' })
}

function ContractMultiFieldProbe(
  props: Omit<ContractMultiFieldProbe, 'type' | 'blockType' | 'variant'>,
): ContractMultiFieldProbe {
  return blockBuilder<ContractMultiFieldProbe>({ ...props, variant: 'contractMultiFieldProbe' })
}

function ContractScopedField(props: Omit<ContractScopedField, 'type' | 'blockType' | 'variant'>): ContractScopedField {
  return fieldBuilder<ContractScopedField>({ ...props, variant: 'contractScopedField' })
}

export const renderingContractComponents = [
  contractFieldComponent,
  contractAsyncFieldComponent,
  contractNestedFieldProbeComponent,
  contractMultiFieldProbeComponent,
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
      blocks: [ContractScopedField({ code: 'scopedField' })],
    }),
  ],
})
