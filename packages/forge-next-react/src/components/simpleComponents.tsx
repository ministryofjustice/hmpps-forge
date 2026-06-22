import type {
  BasicBlockProps,
  BlockDefinition,
  FieldBlockDefinition,
  FieldBlockProps,
  ResolvableString,
} from '@ministryofjustice/hmpps-forge/core/components'
import { block, field } from '@ministryofjustice/hmpps-forge/core/authoring'

import { buildReactComponent } from '../renderer/ReactRenderer'

export interface SimpleTextProps extends BasicBlockProps {
  text: ResolvableString
}

export interface SimpleTextBlock extends BlockDefinition, SimpleTextProps {
  variant: 'simpleText'
}

export interface SimpleTextInputProps extends FieldBlockProps {
  label: ResolvableString
  hint?: ResolvableString
}

export interface SimpleTextInputBlock extends FieldBlockDefinition, SimpleTextInputProps {
  variant: 'simpleTextInput'
}

export interface SimpleSubmitButtonProps extends BasicBlockProps {
  text: ResolvableString
}

export interface SimpleSubmitButtonBlock extends BlockDefinition, SimpleSubmitButtonProps {
  variant: 'simpleSubmitButton'
}

export const simpleText = buildReactComponent<SimpleTextBlock>('simpleText', evaluatedBlock => {
  return <p>{evaluatedBlock.text}</p>
})

export const simpleTextInput = buildReactComponent<SimpleTextInputBlock>('simpleTextInput', evaluatedBlock => {
  const value = typeof evaluatedBlock.value === 'string' ? evaluatedBlock.value : ''
  const hintId = evaluatedBlock.hint == null ? undefined : `${evaluatedBlock.code}-hint`

  return <div>
    <label htmlFor={evaluatedBlock.code}>{evaluatedBlock.label}</label>
    {evaluatedBlock.hint == null ? undefined : <p id={hintId}>{evaluatedBlock.hint}</p>}
    {evaluatedBlock.errors?.map(error => (
      <p key={error.message}>{error.message}</p>
    ))}
    <input
      id={evaluatedBlock.code}
      name={evaluatedBlock.code}
      type="text"
      defaultValue={value}
      aria-describedby={hintId}
      aria-invalid={evaluatedBlock.errors?.length ? true : undefined}
    />
  </div>
})

export const simpleSubmitButton = buildReactComponent<SimpleSubmitButtonBlock>('simpleSubmitButton', evaluatedBlock => {
  return <button type="submit">{evaluatedBlock.text}</button>
})

export const simpleReactComponents = [simpleText, simpleTextInput, simpleSubmitButton]

export function SimpleText(props: SimpleTextProps): SimpleTextBlock {
  return block<SimpleTextBlock>({ ...props, variant: 'simpleText' })
}

export function SimpleTextInput(props: SimpleTextInputProps): SimpleTextInputBlock {
  return field<SimpleTextInputBlock>({ ...props, variant: 'simpleTextInput' })
}

export function SimpleSubmitButton(props: SimpleSubmitButtonProps): SimpleSubmitButtonBlock {
  return block<SimpleSubmitButtonBlock>({ ...props, variant: 'simpleSubmitButton' })
}
