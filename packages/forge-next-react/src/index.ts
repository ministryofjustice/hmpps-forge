export { createNextForgeHandler } from './adapter/createNextForgeHandler'
export type { NextForgeHandler, NextForgeHandlerOptions } from './adapter/createNextForgeHandler'
export type { NextForgeSessionStore, NextRouteContext } from './adapter/types'
export { createNextForgeAction, createNextForgePage } from './adapter/createNextForgePage'
export type {
  NextForgeActionForm,
  NextForgeActionOptions,
  NextForgePageOptions,
  NextForgePageProps,
  NextForgePageSubmitAction,
} from './adapter/createNextForgePage'
export type { ForgeActionFormProps, NextForgeFormAction, NextForgeFormState } from './client'

export { buildReactComponent, FORGE_REACT_ACTION, ReactRenderer } from './renderer/ReactRenderer'
export type {
  ReactComponentRenderer,
  ReactFormAction,
  ReactPageRenderContext,
  ReactPageRenderer,
  ReactRenderedBlock,
  ReactRendererOptions,
} from './renderer/ReactRenderer'

export {
  SimpleSubmitButton,
  SimpleText,
  SimpleTextInput,
  simpleReactComponents,
  simpleSubmitButton,
  simpleText,
  simpleTextInput,
} from './components/simpleComponents'
export type {
  SimpleSubmitButtonBlock,
  SimpleSubmitButtonProps,
  SimpleTextBlock,
  SimpleTextInputBlock,
  SimpleTextInputProps,
  SimpleTextProps,
} from './components/simpleComponents'
