import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalString,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Tag configuration for task status.
 * Renders a colored tag to indicate task completion status.
 *
 * @see https://design-system.service.gov.uk/components/tag/
 */
export interface TaskListStatusTag {
  /** Plain text content for the tag. Required unless html is provided. */
  text?: ConditionalString

  /** HTML content for the tag. Takes precedence over text. */
  html?: ConditionalString

  /**
   * Additional CSS classes for the tag.
   * Use modifier classes like `govuk-tag--blue`, `govuk-tag--grey` to change color.
   */
  classes?: ConditionalString

  /** Custom HTML attributes for the tag element. */
  attributes?: Record<string, any>
}

/**
 * Status configuration for a task list item.
 * Can display either a tag (for statuses like "Completed", "In progress")
 * or plain text/HTML (for statuses like "Cannot start yet").
 */
export interface TaskListStatus {
  /**
   * Tag configuration for the status.
   * Use this for statuses that should be visually prominent.
   * If provided, text and html are ignored.
   */
  tag?: TaskListStatusTag

  /**
   * Plain text for the status.
   * Used when a simpler, non-tag status is needed.
   * Ignored if tag or html is provided.
   */
  text?: ConditionalString

  /**
   * HTML content for the status.
   * Used when custom HTML is needed for the status.
   * Ignored if tag is provided.
   */
  html?: ConditionalString

  /** Additional CSS classes for the status container. */
  classes?: ConditionalString
}

/**
 * Title configuration for a task list item.
 * Contains the main clickable text that describes the task.
 */
export interface TaskListTitle {
  /** Plain text content for the title. Required unless html is provided. */
  text?: ConditionalString

  /** HTML content for the title. Takes precedence over text. */
  html?: ConditionalString

  /** Additional CSS classes for the title wrapper. */
  classes?: ConditionalString
}

/**
 * Hint configuration for a task list item.
 * Provides additional descriptive text below the title.
 */
export interface TaskListHint {
  /** Plain text content for the hint. Required unless html is provided. */
  text?: ConditionalString

  /** HTML content for the hint. Takes precedence over text. */
  html?: ConditionalString
}

/**
 * A single item in the task list.
 * Represents one task with its title, optional hint, status, and link.
 */
export interface TaskListItem {
  /**
   * The main title for the task.
   * This is the primary clickable text that describes what the task involves.
   */
  title: TaskListTitle

  /**
   * Optional hint text displayed below the title.
   * Use to provide additional context about the task.
   */
  hint?: TaskListHint

  /**
   * The status of the task.
   * Displays on the right side of the task row.
   */
  status: TaskListStatus

  /**
   * The URL to navigate to when the task title is clicked.
   * If not provided, the title is rendered as plain text rather than a link.
   */
  href?: ConditionalString

  /** Additional CSS classes for the item div. */
  classes?: ConditionalString
}

/**
 * Props for the GovUKTaskList component.
 *
 * Displays a list of tasks with their completion status.
 * Commonly used to show users a list of tasks they need to complete
 * as part of a multi-step process.
 *
 * @see https://design-system.service.gov.uk/components/task-list/
 * @example
 * ```typescript
 * GovUKTaskList({
 *   items: [
 *     {
 *       title: { text: 'Company information' },
 *       href: '/company-info',
 *       status: {
 *         tag: { text: 'Completed', classes: 'govuk-tag--blue' },
 *       },
 *     },
 *     {
 *       title: { text: 'Contact details' },
 *       hint: { text: 'Include email and phone number' },
 *       href: '/contact-details',
 *       status: {
 *         tag: { text: 'In progress', classes: 'govuk-tag--light-blue' },
 *       },
 *     },
 *     {
 *       title: { text: 'Submit application' },
 *       status: {
 *         text: 'Cannot start yet',
 *       },
 *     },
 *   ],
 * })
 * ```
 */
export interface GovUKTaskListProps extends BasicBlockProps {
  /** The items within the task list. Each item represents a single task. Required. */
  items: TaskListItem[]

  /** Additional CSS classes for the task list ul element. */
  classes?: ConditionalString

  /** Custom HTML attributes for the task list ul element. */
  attributes?: Record<string, any>

  /**
   * Optional prefix for id attributes.
   * Used to prefix the id attribute for task list item tags and hints.
   * Defaults to "task-list".
   */
  idPrefix?: ConditionalString
}

/**
 * GOV.UK Task List Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKTaskListProps` type or the `GovUKTaskList()` wrapper function instead.
 */
export interface GovUKTaskList extends BlockDefinition, GovUKTaskListProps {
  /** Component variant identifier */
  variant: 'govukTaskList'
}

/**
 * Renders the GOV.UK Task List component using the official Nunjucks template.
 */
async function taskListRenderer(
  block: EvaluatedBlock<GovUKTaskList>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params: Record<string, any> = {
    items: block.items,
    classes: block.classes,
    attributes: block.attributes,
    idPrefix: block.idPrefix,
  }

  return nunjucksEnv.render('govuk/components/task-list/template.njk', { params })
}

export const govukTaskList = buildNunjucksComponent<GovUKTaskList>('govukTaskList', taskListRenderer)

/**
 * Creates a GOV.UK Task List for displaying tasks with their completion status.
 * Commonly used to show users a list of tasks they need to complete
 * as part of a multi-step process, such as applying for something or registering.
 *
 * @see https://design-system.service.gov.uk/components/task-list/
 * @example
 * ```typescript
 * GovUKTaskList({
 *   items: [
 *     {
 *       title: { text: 'Company information' },
 *       href: '/company-info',
 *       status: {
 *         tag: { text: 'Completed', classes: 'govuk-tag--blue' },
 *       },
 *     },
 *     {
 *       title: { text: 'Contact details' },
 *       hint: { text: 'Include email and phone number' },
 *       href: '/contact-details',
 *       status: {
 *         tag: { text: 'In progress', classes: 'govuk-tag--light-blue' },
 *       },
 *     },
 *     {
 *       title: { text: 'Submit application' },
 *       status: {
 *         text: 'Cannot start yet',
 *       },
 *     },
 *   ],
 * })
 * ```
 *
 * @example With custom id prefix
 * ```typescript
 * GovUKTaskList({
 *   idPrefix: 'registration',
 *   items: [
 *     {
 *       title: { text: 'Personal details' },
 *       href: '/personal-details',
 *       status: { tag: { text: 'Completed' } },
 *     },
 *   ],
 * })
 * ```
 */
export function GovUKTaskList(props: GovUKTaskListProps): GovUKTaskList {
  return blockBuilder<GovUKTaskList>({ ...props, variant: 'govukTaskList' })
}
