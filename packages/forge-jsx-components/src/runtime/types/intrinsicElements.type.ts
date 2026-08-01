/**
 * Static-HTML intrinsic element attribute types for the forge JSX runtime.
 *
 * Vendored from hono/jsx (https://github.com/honojs/hono, MIT licence), which in turn
 * bases these definitions on React (https://github.com/facebook/react, MIT licence,
 * Copyright (c) Meta Platforms, Inc. and affiliates).
 *
 * Trimmed for server-side string rendering: event handler attributes,
 * `dangerouslySetInnerHTML` and streaming/DOM-only types are removed, and `style`
 * accepts only a string.
 *
 * @experimental Part of the experimental JSX component API - may change or be removed
 * in a minor release.
 */

/* eslint-disable @typescript-eslint/no-empty-object-type -- vendored interfaces mirror hono's shapes */

type StringLiteralUnion<T extends string> = T | (string & Record<never, never>)

type CrossOrigin = 'anonymous' | 'use-credentials' | '' | undefined
type AnyAttributes = {
  [attributeName: string]: any
}
export interface HTMLAttributes extends AnyAttributes {
  accesskey?: string | undefined
  autocapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters' | undefined
  autofocus?: boolean | undefined
  class?: string | undefined
  contenteditable?: boolean | 'inherit' | 'plaintext-only' | undefined
  contextmenu?: string | undefined
  dir?: string | undefined
  draggable?: 'true' | 'false' | boolean | undefined
  enterkeyhint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send' | undefined
  hidden?: boolean | undefined
  id?: string | undefined
  inert?: boolean | undefined
  inputmode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search' | undefined
  is?: string | undefined
  itemid?: string | undefined
  itemprop?: string | undefined
  itemref?: string | undefined
  itemscope?: boolean | undefined
  itemtype?: string | undefined
  lang?: string | undefined
  nonce?: string | undefined
  placeholder?: string | undefined
  /** @see https://developer.mozilla.org/en-US/docs/Web/API/Popover_API */
  popover?: boolean | 'auto' | 'manual' | undefined
  slot?: string | undefined
  spellcheck?: boolean | undefined
  style?: string | undefined
  tabindex?: number | undefined
  title?: string | undefined
  translate?: 'yes' | 'no' | undefined
  itemProp?: string | undefined
}
type HTMLAttributeReferrerPolicy =
  | ''
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url'
type HTMLAttributeAnchorTarget = StringLiteralUnion<'_self' | '_blank' | '_parent' | '_top'>
interface AnchorHTMLAttributes extends HTMLAttributes {
  download?: string | boolean | undefined
  href?: string | undefined
  hreflang?: string | undefined
  media?: string | undefined
  ping?: string | undefined
  target?: HTMLAttributeAnchorTarget | undefined
  type?: string | undefined
  referrerpolicy?: HTMLAttributeReferrerPolicy | undefined
}
interface AudioHTMLAttributes extends MediaHTMLAttributes {}
interface AreaHTMLAttributes extends HTMLAttributes {
  alt?: string | undefined
  coords?: string | undefined
  download?: string | boolean | undefined
  href?: string | undefined
  hreflang?: string | undefined
  media?: string | undefined
  referrerpolicy?: HTMLAttributeReferrerPolicy | undefined
  shape?: string | undefined
  target?: HTMLAttributeAnchorTarget | undefined
}
interface BaseHTMLAttributes extends HTMLAttributes {
  href?: string | undefined
  target?: HTMLAttributeAnchorTarget | undefined
}
interface BlockquoteHTMLAttributes extends HTMLAttributes {
  cite?: string | undefined
}
/** @see https://developer.mozilla.org/en-US/docs/Web/API/Popover_API */
type HTMLAttributePopoverTargetAction = 'show' | 'hide' | 'toggle'
interface ButtonHTMLAttributes extends HTMLAttributes {
  disabled?: boolean | undefined
  form?: string | undefined
  formenctype?: HTMLAttributeFormEnctype | undefined
  formmethod?: HTMLAttributeFormMethod | undefined
  formnovalidate?: boolean | undefined
  formtarget?: HTMLAttributeAnchorTarget | undefined
  name?: string | undefined
  type?: 'submit' | 'reset' | 'button' | undefined
  value?: string | ReadonlyArray<string> | number | undefined
  popovertarget?: string | undefined
  popovertargetaction?: HTMLAttributePopoverTargetAction | undefined
  formAction?: string | undefined
}
interface CanvasHTMLAttributes extends HTMLAttributes {
  height?: number | string | undefined
  width?: number | string | undefined
}
interface ColHTMLAttributes extends HTMLAttributes {
  span?: number | undefined
  width?: number | string | undefined
}
interface ColgroupHTMLAttributes extends HTMLAttributes {
  span?: number | undefined
}
interface DataHTMLAttributes extends HTMLAttributes {
  value?: string | ReadonlyArray<string> | number | undefined
}
interface DetailsHTMLAttributes extends HTMLAttributes {
  open?: boolean | undefined
}
interface DelHTMLAttributes extends HTMLAttributes {
  cite?: string | undefined
  dateTime?: string | undefined
}
interface DialogHTMLAttributes extends HTMLAttributes {
  open?: boolean | undefined
}
interface EmbedHTMLAttributes extends HTMLAttributes {
  height?: number | string | undefined
  src?: string | undefined
  type?: string | undefined
  width?: number | string | undefined
}
interface FieldsetHTMLAttributes extends HTMLAttributes {
  disabled?: boolean | undefined
  form?: string | undefined
  name?: string | undefined
}
/** @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form#method */
type HTMLAttributeFormMethod = 'get' | 'post' | 'dialog'
/** @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form#enctype */
type HTMLAttributeFormEnctype = 'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'
/** @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form#autocomplete */
type HTMLAttributeFormAutocomplete = 'on' | 'off'
interface FormHTMLAttributes extends HTMLAttributes {
  'accept-charset'?: StringLiteralUnion<'utf-8'> | undefined
  autocomplete?: HTMLAttributeFormAutocomplete | undefined
  enctype?: HTMLAttributeFormEnctype | undefined
  method?: HTMLAttributeFormMethod | undefined
  name?: string | undefined
  novalidate?: boolean | undefined
  target?: HTMLAttributeAnchorTarget | undefined
  action?: string | undefined
}
interface HtmlHTMLAttributes extends HTMLAttributes {
  manifest?: string | undefined
}
interface IframeHTMLAttributes extends HTMLAttributes {
  allow?: string | undefined
  allowfullscreen?: boolean | undefined
  height?: number | string | undefined
  loading?: 'eager' | 'lazy' | undefined
  name?: string | undefined
  referrerpolicy?: HTMLAttributeReferrerPolicy | undefined
  sandbox?: string | undefined
  seamless?: boolean | undefined
  src?: string | undefined
  srcdoc?: string | undefined
  width?: number | string | undefined
}
interface ImgHTMLAttributes extends HTMLAttributes {
  alt?: string | undefined
  crossorigin?: CrossOrigin
  decoding?: 'async' | 'auto' | 'sync' | undefined
  height?: number | string | undefined
  loading?: 'eager' | 'lazy' | undefined
  referrerpolicy?: HTMLAttributeReferrerPolicy | undefined
  sizes?: string | undefined
  src?: string | undefined
  srcset?: string | undefined
  usemap?: string | undefined
  width?: number | string | undefined
}
interface InsHTMLAttributes extends HTMLAttributes {
  cite?: string | undefined
  datetime?: string | undefined
}
type HTMLInputTypeAttribute = StringLiteralUnion<
  | 'button'
  | 'checkbox'
  | 'color'
  | 'date'
  | 'datetime-local'
  | 'email'
  | 'file'
  | 'hidden'
  | 'image'
  | 'month'
  | 'number'
  | 'password'
  | 'radio'
  | 'range'
  | 'reset'
  | 'search'
  | 'submit'
  | 'tel'
  | 'text'
  | 'time'
  | 'url'
  | 'week'
>
type AutoFillAddressKind = 'billing' | 'shipping'
type AutoFillBase = '' | 'off' | 'on'
type AutoFillContactField =
  | 'email'
  | 'tel'
  | 'tel-area-code'
  | 'tel-country-code'
  | 'tel-extension'
  | 'tel-local'
  | 'tel-local-prefix'
  | 'tel-local-suffix'
  | 'tel-national'
type AutoFillContactKind = 'home' | 'mobile' | 'work'
type AutoFillCredentialField = 'webauthn'
type AutoFillNormalField =
  | 'additional-name'
  | 'address-level1'
  | 'address-level2'
  | 'address-level3'
  | 'address-level4'
  | 'address-line1'
  | 'address-line2'
  | 'address-line3'
  | 'bday-day'
  | 'bday-month'
  | 'bday-year'
  | 'cc-csc'
  | 'cc-exp'
  | 'cc-exp-month'
  | 'cc-exp-year'
  | 'cc-family-name'
  | 'cc-given-name'
  | 'cc-name'
  | 'cc-number'
  | 'cc-type'
  | 'country'
  | 'country-name'
  | 'current-password'
  | 'family-name'
  | 'given-name'
  | 'honorific-prefix'
  | 'honorific-suffix'
  | 'name'
  | 'new-password'
  | 'one-time-code'
  | 'organization'
  | 'postal-code'
  | 'street-address'
  | 'transaction-amount'
  | 'transaction-currency'
  | 'username'
type OptionalPrefixToken<T extends string> = `${T} ` | ''
type OptionalPostfixToken<T extends string> = ` ${T}` | ''
type AutoFillField = AutoFillNormalField | `${OptionalPrefixToken<AutoFillContactKind>}${AutoFillContactField}`
type AutoFillSection = `section-${string}`
type AutoFill =
  | AutoFillBase
  | `${OptionalPrefixToken<AutoFillSection>}${OptionalPrefixToken<AutoFillAddressKind>}${AutoFillField}${OptionalPostfixToken<AutoFillCredentialField>}`
interface InputHTMLAttributes extends HTMLAttributes {
  accept?: string | undefined
  alt?: string | undefined
  autocomplete?: StringLiteralUnion<AutoFill> | undefined
  capture?: boolean | 'user' | 'environment' | undefined
  checked?: boolean | undefined
  disabled?: boolean | undefined
  form?: string | undefined
  formenctype?: HTMLAttributeFormEnctype | undefined
  formmethod?: HTMLAttributeFormMethod | undefined
  formnovalidate?: boolean | undefined
  formtarget?: HTMLAttributeAnchorTarget | undefined
  height?: number | string | undefined
  list?: string | undefined
  max?: number | string | undefined
  maxlength?: number | undefined
  min?: number | string | undefined
  minlength?: number | undefined
  multiple?: boolean | undefined
  name?: string | undefined
  pattern?: string | undefined
  placeholder?: string | undefined
  readonly?: boolean | undefined
  required?: boolean | undefined
  size?: number | undefined
  src?: string | undefined
  step?: number | string | undefined
  type?: HTMLInputTypeAttribute | undefined
  value?: string | ReadonlyArray<string> | number | undefined
  width?: number | string | undefined
  popovertarget?: string | undefined
  popovertargetaction?: HTMLAttributePopoverTargetAction | undefined
  formAction?: string | undefined
}
interface KeygenHTMLAttributes extends HTMLAttributes {
  challenge?: string | undefined
  disabled?: boolean | undefined
  form?: string | undefined
  keytype?: string | undefined
  name?: string | undefined
}
interface LabelHTMLAttributes extends HTMLAttributes {
  form?: string | undefined
  for?: string | undefined
}
interface LiHTMLAttributes extends HTMLAttributes {
  value?: string | ReadonlyArray<string> | number | undefined
}
interface LinkHTMLAttributes extends HTMLAttributes {
  as?: string | undefined
  crossorigin?: CrossOrigin
  href?: string | undefined
  hreflang?: string | undefined
  integrity?: string | undefined
  media?: string | undefined
  imagesrcset?: string | undefined
  imagesizes?: string | undefined
  referrerpolicy?: HTMLAttributeReferrerPolicy | undefined
  sizes?: string | undefined
  type?: string | undefined
  charSet?: string | undefined
  rel?: string | undefined
  precedence?: string | undefined
  title?: string | undefined
  disabled?: boolean | undefined
  blocking?: 'render' | undefined
}
interface MapHTMLAttributes extends HTMLAttributes {
  name?: string | undefined
}
interface MenuHTMLAttributes extends HTMLAttributes {
  type?: string | undefined
}
interface MediaHTMLAttributes extends HTMLAttributes {
  autoplay?: boolean | undefined
  controls?: boolean | undefined
  controlslist?: string | undefined
  crossorigin?: CrossOrigin
  loop?: boolean | undefined
  mediagroup?: string | undefined
  muted?: boolean | undefined
  playsinline?: boolean | undefined
  preload?: string | undefined
  src?: string | undefined
}
/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#http-equiv
 */
type MetaHttpEquiv = 'content-security-policy' | 'content-type' | 'default-style' | 'x-ua-compatible' | 'refresh'
/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name
 */
type MetaName =
  | 'application-name'
  | 'author'
  | 'description'
  | 'generator'
  | 'keywords'
  | 'referrer'
  | 'theme-color'
  | 'color-scheme'
  | 'viewport'
  | 'creator'
  | 'googlebot'
  | 'publisher'
  | 'robots'
/**
 * @see https://ogp.me/
 */
type MetaProperty =
  | 'og:title'
  | 'og:type'
  | 'og:image'
  | 'og:url'
  | 'og:audio'
  | 'og:description'
  | 'og:determiner'
  | 'og:locale'
  | 'og:locale:alternate'
  | 'og:site_name'
  | 'og:video'
  | 'og:image:url'
  | 'og:image:secure_url'
  | 'og:image:type'
  | 'og:image:width'
  | 'og:image:height'
  | 'og:image:alt'
interface MetaHTMLAttributes extends HTMLAttributes {
  charset?: StringLiteralUnion<'utf-8'> | undefined
  'http-equiv'?: StringLiteralUnion<MetaHttpEquiv> | undefined
  name?: StringLiteralUnion<MetaName> | undefined
  media?: string | undefined
  content?: string | undefined
  property?: StringLiteralUnion<MetaProperty> | undefined
  httpEquiv?: StringLiteralUnion<MetaHttpEquiv> | undefined
}
interface MeterHTMLAttributes extends HTMLAttributes {
  form?: string | undefined
  high?: number | undefined
  low?: number | undefined
  max?: number | string | undefined
  min?: number | string | undefined
  optimum?: number | undefined
  value?: string | ReadonlyArray<string> | number | undefined
}
interface QuoteHTMLAttributes extends HTMLAttributes {
  cite?: string | undefined
}
interface ObjectHTMLAttributes extends HTMLAttributes {
  data?: string | undefined
  form?: string | undefined
  height?: number | string | undefined
  name?: string | undefined
  type?: string | undefined
  usemap?: string | undefined
  width?: number | string | undefined
}
interface OlHTMLAttributes extends HTMLAttributes {
  reversed?: boolean | undefined
  start?: number | undefined
  type?: '1' | 'a' | 'A' | 'i' | 'I' | undefined
}
interface OptgroupHTMLAttributes extends HTMLAttributes {
  disabled?: boolean | undefined
  label?: string | undefined
}
interface OptionHTMLAttributes extends HTMLAttributes {
  disabled?: boolean | undefined
  label?: string | undefined
  selected?: boolean | undefined
  value?: string | ReadonlyArray<string> | number | undefined
}
interface OutputHTMLAttributes extends HTMLAttributes {
  form?: string | undefined
  for?: string | undefined
  name?: string | undefined
}
interface ParamHTMLAttributes extends HTMLAttributes {
  name?: string | undefined
  value?: string | ReadonlyArray<string> | number | undefined
}
interface ProgressHTMLAttributes extends HTMLAttributes {
  max?: number | string | undefined
  value?: string | ReadonlyArray<string> | number | undefined
}
interface SlotHTMLAttributes extends HTMLAttributes {
  name?: string | undefined
}
interface ScriptHTMLAttributes extends HTMLAttributes {
  async?: boolean | undefined
  crossorigin?: CrossOrigin
  defer?: boolean | undefined
  integrity?: string | undefined
  nomodule?: boolean | undefined
  referrerpolicy?: HTMLAttributeReferrerPolicy | undefined
  src?: string | undefined
  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type
   */
  type?: StringLiteralUnion<'' | 'text/javascript' | 'importmap' | 'module'> | undefined
  crossOrigin?: CrossOrigin
  fetchPriority?: string | undefined
  noModule?: boolean | undefined
  referrer?: HTMLAttributeReferrerPolicy | undefined
  blocking?: 'render' | undefined
}
interface SelectHTMLAttributes extends HTMLAttributes {
  autocomplete?: StringLiteralUnion<AutoFill> | undefined
  disabled?: boolean | undefined
  form?: string | undefined
  multiple?: boolean | undefined
  name?: string | undefined
  required?: boolean | undefined
  size?: number | undefined
  value?: string | ReadonlyArray<string> | number | undefined
}
type MediaMime = `image/${string}` | `audio/${string}` | `video/${string}`
interface SourceHTMLAttributes extends HTMLAttributes {
  height?: number | string | undefined
  media?: string | undefined
  sizes?: string | undefined
  src?: string | undefined
  srcset?: string | undefined
  type?: StringLiteralUnion<MediaMime> | undefined
  width?: number | string | undefined
}
interface StyleHTMLAttributes extends HTMLAttributes {
  media?: string | undefined
  scoped?: boolean | undefined
  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/style#type
   */
  type?: '' | 'text/css' | undefined
  href?: string | undefined
  precedence?: string | undefined
  title?: string | undefined
  disabled?: boolean | undefined
  blocking?: 'render' | undefined
}
interface TableHTMLAttributes extends HTMLAttributes {
  align?: 'left' | 'center' | 'right' | undefined
  bgcolor?: string | undefined
  border?: number | undefined
  cellpadding?: number | string | undefined
  cellspacing?: number | string | undefined
  frame?: boolean | undefined
  rules?: 'none' | 'groups' | 'rows' | 'columns' | 'all' | undefined
  summary?: string | undefined
  width?: number | string | undefined
}
interface TextareaHTMLAttributes extends HTMLAttributes {
  autocomplete?: StringLiteralUnion<AutoFill> | undefined
  cols?: number | undefined
  dirname?: string | undefined
  disabled?: boolean | undefined
  form?: string | undefined
  maxlength?: number | undefined
  minlength?: number | undefined
  name?: string | undefined
  placeholder?: string | undefined
  readonly?: boolean | undefined
  required?: boolean | undefined
  rows?: number | undefined
  value?: string | ReadonlyArray<string> | number | undefined
  wrap?: string | undefined
}
interface TdHTMLAttributes extends HTMLAttributes {
  align?: 'left' | 'center' | 'right' | 'justify' | 'char' | undefined
  colspan?: number | undefined
  headers?: string | undefined
  rowspan?: number | undefined
  scope?: string | undefined
  abbr?: string | undefined
  height?: number | string | undefined
  width?: number | string | undefined
  valign?: 'top' | 'middle' | 'bottom' | 'baseline' | undefined
}
interface ThHTMLAttributes extends HTMLAttributes {
  align?: 'left' | 'center' | 'right' | 'justify' | 'char' | undefined
  colspan?: number | undefined
  headers?: string | undefined
  rowspan?: number | undefined
  scope?: 'row' | 'col' | 'rowgroup' | 'colgroup' | string | undefined
  abbr?: string | undefined
}
interface TimeHTMLAttributes extends HTMLAttributes {
  datetime?: string | undefined
}
interface TrackHTMLAttributes extends HTMLAttributes {
  default?: boolean | undefined
  kind?: string | undefined
  label?: string | undefined
  src?: string | undefined
  srclang?: string | undefined
}
interface VideoHTMLAttributes extends MediaHTMLAttributes {
  height?: number | string | undefined
  playsinline?: boolean | undefined
  poster?: string | undefined
  width?: number | string | undefined
  disablePictureInPicture?: boolean | undefined
  disableRemotePlayback?: boolean | undefined
}
export interface IntrinsicElementAttributes {
  a: AnchorHTMLAttributes
  abbr: HTMLAttributes
  address: HTMLAttributes
  area: AreaHTMLAttributes
  article: HTMLAttributes
  aside: HTMLAttributes
  audio: AudioHTMLAttributes
  b: HTMLAttributes
  base: BaseHTMLAttributes
  bdi: HTMLAttributes
  bdo: HTMLAttributes
  big: HTMLAttributes
  blockquote: BlockquoteHTMLAttributes
  body: HTMLAttributes
  br: HTMLAttributes
  button: ButtonHTMLAttributes
  canvas: CanvasHTMLAttributes
  caption: HTMLAttributes
  center: HTMLAttributes
  cite: HTMLAttributes
  code: HTMLAttributes
  col: ColHTMLAttributes
  colgroup: ColgroupHTMLAttributes
  data: DataHTMLAttributes
  datalist: HTMLAttributes
  dd: HTMLAttributes
  del: DelHTMLAttributes
  details: DetailsHTMLAttributes
  dfn: HTMLAttributes
  dialog: DialogHTMLAttributes
  div: HTMLAttributes
  dl: HTMLAttributes
  dt: HTMLAttributes
  em: HTMLAttributes
  embed: EmbedHTMLAttributes
  fieldset: FieldsetHTMLAttributes
  figcaption: HTMLAttributes
  figure: HTMLAttributes
  footer: HTMLAttributes
  form: FormHTMLAttributes
  h1: HTMLAttributes
  h2: HTMLAttributes
  h3: HTMLAttributes
  h4: HTMLAttributes
  h5: HTMLAttributes
  h6: HTMLAttributes
  head: HTMLAttributes
  header: HTMLAttributes
  hgroup: HTMLAttributes
  hr: HTMLAttributes
  html: HtmlHTMLAttributes
  i: HTMLAttributes
  iframe: IframeHTMLAttributes
  img: ImgHTMLAttributes
  input: InputHTMLAttributes
  ins: InsHTMLAttributes
  kbd: HTMLAttributes
  keygen: KeygenHTMLAttributes
  label: LabelHTMLAttributes
  legend: HTMLAttributes
  li: LiHTMLAttributes
  link: LinkHTMLAttributes
  main: HTMLAttributes
  map: MapHTMLAttributes
  mark: HTMLAttributes
  menu: MenuHTMLAttributes
  menuitem: HTMLAttributes
  meta: MetaHTMLAttributes
  meter: MeterHTMLAttributes
  nav: HTMLAttributes
  noscript: HTMLAttributes
  object: ObjectHTMLAttributes
  ol: OlHTMLAttributes
  optgroup: OptgroupHTMLAttributes
  option: OptionHTMLAttributes
  output: OutputHTMLAttributes
  p: HTMLAttributes
  param: ParamHTMLAttributes
  picture: HTMLAttributes
  pre: HTMLAttributes
  progress: ProgressHTMLAttributes
  q: QuoteHTMLAttributes
  rp: HTMLAttributes
  rt: HTMLAttributes
  ruby: HTMLAttributes
  s: HTMLAttributes
  samp: HTMLAttributes
  search: HTMLAttributes
  slot: SlotHTMLAttributes
  script: ScriptHTMLAttributes
  section: HTMLAttributes
  select: SelectHTMLAttributes
  small: HTMLAttributes
  source: SourceHTMLAttributes
  span: HTMLAttributes
  strong: HTMLAttributes
  style: StyleHTMLAttributes
  sub: HTMLAttributes
  summary: HTMLAttributes
  sup: HTMLAttributes
  table: TableHTMLAttributes
  template: HTMLAttributes
  tbody: HTMLAttributes
  td: TdHTMLAttributes
  textarea: TextareaHTMLAttributes
  tfoot: HTMLAttributes
  th: ThHTMLAttributes
  thead: HTMLAttributes
  time: TimeHTMLAttributes
  title: HTMLAttributes
  tr: HTMLAttributes
  track: TrackHTMLAttributes
  u: HTMLAttributes
  ul: HTMLAttributes
  var: HTMLAttributes
  video: VideoHTMLAttributes
  wbr: HTMLAttributes
}
