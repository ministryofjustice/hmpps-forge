import { buildNunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import { field as buildField } from '@ministryofjustice/hmpps-forge/core/authoring'
import type {
  ResolvableBoolean,
  ResolvableString,
  FieldBlockDefinition,
  FieldBlockProps,
} from '@ministryofjustice/hmpps-forge/core/components'

export interface RichTextEditorToolbar {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  bullets?: boolean
  numbers?: boolean
}

export interface RichTextEditorProps extends FieldBlockProps {
  id?: ResolvableString
  rows?: ResolvableString
  toolbar?: RichTextEditorToolbar
  label?:
    | ResolvableString
    | {
        text?: ResolvableString
        html?: ResolvableString
        classes?: ResolvableString
        isPageHeading?: ResolvableBoolean
      }
  hint?:
    | ResolvableString
    | {
        text?: ResolvableString
        html?: ResolvableString
        classes?: ResolvableString
      }
  classes?: ResolvableString
}

export interface RichTextEditor extends FieldBlockDefinition, RichTextEditorProps {
  variant: 'richTextEditor'
}

export const richTextEditorComponent = buildNunjucksComponent<RichTextEditor>(
  'richTextEditor',
  (block, nunjucksEnv) => {
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
)

export function RichTextEditor(props: RichTextEditorProps): RichTextEditor {
  return buildField<RichTextEditor>({ ...props, variant: 'richTextEditor' })
}
