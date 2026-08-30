import { nunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'

export interface RichTextEditorToolbar {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  bullets?: boolean
  numbers?: boolean
}

export interface RichTextEditor {
  id?: string
  rows?: string
  toolbar?: RichTextEditorToolbar
  label?:
    | string
    | {
        text?: string
        html?: string
        classes?: string
        isPageHeading?: boolean
      }
  hint?:
    | string
    | {
        text?: string
        html?: string
        classes?: string
      }
  classes?: string
}

export const RichTextEditor = nunjucksComponent<RichTextEditor>('richTextEditor', {
  field: true,
  factory:
    ({ nunjucksEnv }) =>
    ({ props }) => {
      const toolbar = props.toolbar ?? {
        bold: true,
        italic: true,
        underline: true,
        bullets: true,
        numbers: true,
      }

      const toolbarAttributes: Record<string, string> = {
        'data-module': 'moj-rich-text-editor',
      }

      for (const [key, enabled] of Object.entries(toolbar)) {
        if (enabled) {
          toolbarAttributes[`data-toolbar.${key}`] = 'true'
        }
      }

      const normaliseStringOrObject = (value: unknown) => {
        if (!value) {
          return undefined
        }

        return typeof value === 'object' ? value : { text: value }
      }

      const params = {
        id: props.id ?? props.code,
        name: props.code,
        rows: props.rows || '8',
        value: props.value,
        label: normaliseStringOrObject(props.label),
        hint: normaliseStringOrObject(props.hint),
        errorMessage: props.errors?.length && { text: props.errors[0].message },
        formGroup: {
          attributes: toolbarAttributes,
        },
        classes: props.classes,
      }

      return nunjucksEnv.render('govuk/components/textarea/template.njk', { params })
    },
})
