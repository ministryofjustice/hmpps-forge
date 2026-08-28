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
  render: (block, nunjucksEnv) => {
    const toolbar = block.toolbar ?? {
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
      id: block.id ?? block.code,
      name: block.code,
      rows: block.rows || '8',
      value: block.value,
      label: normaliseStringOrObject(block.label),
      hint: normaliseStringOrObject(block.hint),
      errorMessage: block.errors?.length && { text: block.errors[0].message },
      formGroup: {
        attributes: toolbarAttributes,
      },
      classes: block.classes,
    }

    return nunjucksEnv.render('govuk/components/textarea/template.njk', { params })
  },
})
