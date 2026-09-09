import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ForgeDeveloperGuideMarkdownBlock } from '../forge-developer-guide/components/forgeDeveloperGuideMarkdown'

/**
 * The single markdown-rendering block shared by every generated v2 page.
 * The markdown body is loaded into `Data` by the LoadContent effect; the
 * page's "On this page" navigation is rendered by the template from
 * `Data('headings')`.
 */
export const contentBlock = ForgeDeveloperGuideMarkdownBlock({
  content: Data('content'),
})
