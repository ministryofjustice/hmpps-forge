import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import type { ForgeOutcome, HttpMethod, RenderContext } from '@ministryofjustice/hmpps-forge/core/framework'

import {
  LlmConversation,
  type LlmAnswerAmendment,
  type LlmAnswerValue,
  type LlmPriorAnswer,
  type LlmSupplier,
  type LlmTurnResolution,
} from '../conversation/LlmConversation'
import type { LlmQuestionOutput, LlmTurnOutput } from '../functions/renderers/turn/llmTurn'
import { LlmConversationAlreadyExistsError } from './LlmConversationAlreadyExistsError'
import { LlmConversationNotFoundError } from './LlmConversationNotFoundError'
import { LlmRenderer } from './LlmRenderer'
import type { LlmRegisteredQuestion, LlmSession, LlmSessionStore } from './LlmSessionStore'
import { LlmSnapshotFactory, type ResolvedLlmRoute } from './LlmSnapshotFactory'

export interface LlmAdapterOptions {
  readonly forge: Forge
  readonly supplier: LlmSupplier
  readonly sessionStore: LlmSessionStore

  /** Origin supplied to Forge request locations. Defaults to `http://localhost`. */
  readonly origin?: string
}

export interface LlmStartRequest {
  readonly conversationId: string
  readonly entryPath: string
}

export interface LlmRespondRequest {
  readonly conversationId: string
  readonly message: string
}

export interface LlmEndRequest {
  readonly conversationId: string
}

export interface LlmAwaitingInputResult {
  readonly status: 'awaiting-input'
  readonly message: string
  readonly turn: LlmTurnOutput
}

export interface LlmCompleteResult {
  readonly status: 'complete'
  readonly message: string
  readonly turn: LlmTurnOutput
}

export interface LlmNavigateResult {
  readonly status: 'navigate'
  readonly url: string
}

export type LlmAdapterResult = LlmAwaitingInputResult | LlmCompleteResult | LlmNavigateResult

interface ActiveTurn {
  readonly path: string
  readonly turn: LlmTurnOutput
}

interface ActiveSession {
  readonly requestSession: Record<string, unknown>
  readonly conversation: LlmConversation
  activeTurn: ActiveTurn
  readonly presentedPaths: Set<string>
  readonly questionsByCode: Map<string, LlmRegisteredQuestion>
  readonly recordedAnswers: Record<string, LlmAnswerValue>
  readonly answerRevisionByCode: Map<string, number>
  userMessageRevision: number
}

type TurnSubmission =
  | { readonly kind: 'render'; readonly activeTurn: ActiveTurn }
  | { readonly kind: 'navigate'; readonly path: string }

type TurnRender =
  | { readonly kind: 'render'; readonly activeTurn: ActiveTurn }
  | { readonly kind: 'navigate'; url: string }

/** Drives Forge journeys as persisted, supplier-neutral conversations. */
export class LlmAdapter {
  private readonly renderer = new LlmRenderer()

  private readonly snapshotFactory: LlmSnapshotFactory

  private readonly origin: string

  constructor(private readonly options: LlmAdapterOptions) {
    this.origin = new URL(options.origin ?? 'http://localhost').origin
    this.snapshotFactory = new LlmSnapshotFactory(this.origin)
  }

  async start(request: LlmStartRequest): Promise<LlmAdapterResult> {
    const existingSession = await this.options.sessionStore.get(request.conversationId)

    if (existingSession !== undefined) {
      throw new LlmConversationAlreadyExistsError(request.conversationId)
    }

    const requestSession: Record<string, unknown> = {}
    const activeSession = this.createActiveSessionPlaceholder(requestSession)
    const rendered = await this.renderTurn(request.entryPath, requestSession, activeSession)

    if (rendered.kind === 'navigate') {
      return { status: 'navigate', url: rendered.url }
    }

    activeSession.activeTurn = rendered.activeTurn
    const result = await this.presentTurn(activeSession)

    await this.saveSession(request.conversationId, activeSession)

    return result
  }

  async respond(request: LlmRespondRequest): Promise<LlmAdapterResult> {
    const message = request.message.trim()

    if (message.length === 0) {
      throw new TypeError('An LLM conversation response cannot be empty')
    }

    const storedSession = await this.options.sessionStore.get(request.conversationId)

    if (storedSession === undefined) {
      throw new LlmConversationNotFoundError(request.conversationId)
    }

    const activeSession = this.restoreActiveSession(storedSession)

    activeSession.conversation.addUserMessage(message)
    activeSession.userMessageRevision += 1

    const result = await this.advanceConversation(activeSession)

    await this.saveSession(request.conversationId, activeSession)

    return result
  }

  async end(request: LlmEndRequest): Promise<void> {
    await this.options.sessionStore.delete(request.conversationId)
  }

  private async advanceConversation(activeSession: ActiveSession): Promise<LlmAdapterResult> {
    while (activeSession.activeTurn.turn.questions.length > 0) {
      const resolution = await activeSession.conversation.resolveTurn(
        activeSession.activeTurn.turn,
        this.getPriorAnswers(activeSession),
      )

      if (resolution.interaction?.kind === 'clarification' && resolution.interaction.message !== undefined) {
        activeSession.conversation.addAssistantMessage(resolution.interaction.message)

        return {
          status: 'awaiting-input',
          message: resolution.interaction.message,
          turn: activeSession.activeTurn.turn,
        }
      }

      const submission = await this.submitResolution(activeSession, resolution)

      if (submission.kind === 'render') {
        activeSession.activeTurn = submission.activeTurn

        return this.presentTurn(activeSession)
      }

      const rendered = await this.renderTurn(submission.path, activeSession.requestSession, activeSession)

      if (rendered.kind === 'navigate') {
        return { status: 'navigate', url: rendered.url }
      }

      activeSession.activeTurn = rendered.activeTurn

      if (activeSession.activeTurn.turn.questions.length === 0) {
        return this.presentTurn(activeSession)
      }

      if (activeSession.activeTurn.turn.questions.some(question => question.requiresExplicitAnswer === true)) {
        return this.presentTurn(activeSession)
      }
    }

    return this.presentTurn(activeSession)
  }

  private async presentTurn(activeSession: ActiveSession): Promise<LlmAwaitingInputResult | LlmCompleteResult> {
    const { path, turn } = activeSession.activeTurn
    const normalizedPath = this.normalizePath(path)
    const includeContent = !activeSession.presentedPaths.has(normalizedPath)

    if (turn.questions.length === 0) {
      const message = includeContent ? turn.content.map(item => item.content).join('\n\n') : ''

      if (message.length > 0) {
        activeSession.conversation.addAssistantMessage(message)
      }

      activeSession.presentedPaths.add(normalizedPath)

      return { status: 'complete', message, turn }
    }

    const message = await activeSession.conversation.buildPrompt(turn, includeContent)

    activeSession.conversation.addAssistantMessage(message)
    activeSession.presentedPaths.add(normalizedPath)

    return { status: 'awaiting-input', message, turn }
  }

  private async submitResolution(activeSession: ActiveSession, resolution: LlmTurnResolution): Promise<TurnSubmission> {
    const amendment = resolution.amendments[0]

    if (amendment !== undefined) {
      const submission = await this.submitAmendment(activeSession, amendment)

      if (submission.kind === 'navigate') {
        activeSession.recordedAnswers[amendment.code] = amendment.answer
        activeSession.answerRevisionByCode.set(amendment.code, activeSession.userMessageRevision)
      }

      return submission
    }

    const renderedAnswers = Object.fromEntries(
      activeSession.activeTurn.turn.questions.flatMap(question =>
        this.isAnswerValue(question.value) ? [[question.code, question.value]] : [],
      ),
    )
    const answers = { ...renderedAnswers, ...resolution.answers }
    const submission = await this.submitAnswers(activeSession, activeSession.activeTurn.path, answers)

    if (submission.kind === 'navigate') {
      Object.entries(answers).forEach(([code, answer]) => {
        activeSession.recordedAnswers[code] = answer
      })
      Object.keys(resolution.answers).forEach(code => {
        activeSession.answerRevisionByCode.set(code, activeSession.userMessageRevision)
      })
    }

    return submission
  }

  private async submitAmendment(activeSession: ActiveSession, amendment: LlmAnswerAmendment): Promise<TurnSubmission> {
    const answers = Object.fromEntries(
      [...activeSession.questionsByCode.values()].flatMap(registeredQuestion => {
        const answer = activeSession.recordedAnswers[registeredQuestion.question.code]

        return registeredQuestion.path === amendment.path && this.isAnswerValue(answer)
          ? [[registeredQuestion.question.code, answer]]
          : []
      }),
    )

    answers[amendment.code] = amendment.answer

    return this.submitAnswers(activeSession, amendment.path, answers)
  }

  private async submitAnswers(
    activeSession: ActiveSession,
    path: string,
    answers: Readonly<Record<string, LlmAnswerValue>>,
  ): Promise<TurnSubmission> {
    const outcome = await this.execute('POST', path, { ...answers }, activeSession.requestSession)

    if (outcome.kind === 'error') {
      throw outcome.error
    }

    if (outcome.kind === 'navigate') {
      return { kind: 'navigate', path: outcome.url }
    }

    return {
      kind: 'render',
      activeTurn: this.readTurn(activeSession, path, outcome.output, outcome.context),
    }
  }

  private async renderTurn(
    initialPath: string,
    requestSession: Record<string, unknown>,
    activeSession?: ActiveSession,
  ): Promise<TurnRender> {
    let path = initialPath
    const visitedPaths = new Set<string>()

    while (true) {
      const normalizedPath = this.normalizeUrl(path)

      if (visitedPaths.has(normalizedPath)) {
        throw new Error(`Forge navigation entered a redirect loop at ${normalizedPath}`)
      }

      visitedPaths.add(normalizedPath)

      const resolvedRoute = this.snapshotFactory.resolve('GET', path, this.options.forge.getTopology())

      if (resolvedRoute === undefined) {
        return { kind: 'navigate', url: path }
      }

      const outcome = await this.executeResolved('GET', path, resolvedRoute, {}, requestSession)

      if (outcome.kind === 'error') {
        throw outcome.error
      }

      if (outcome.kind === 'navigate') {
        path = outcome.url
        continue
      }

      const session = activeSession ?? this.createActiveSessionPlaceholder(requestSession)

      return { kind: 'render', activeTurn: this.readTurn(session, path, outcome.output, outcome.context) }
    }
  }

  private async execute(
    method: HttpMethod,
    path: string,
    post: Record<string, unknown>,
    requestSession: Record<string, unknown>,
  ): Promise<ForgeOutcome<unknown>> {
    const resolvedRoute = this.snapshotFactory.resolve(method, path, this.options.forge.getTopology())

    if (resolvedRoute === undefined) {
      throw new Error(`Forge did not register a route for ${method} ${this.normalizePath(path)}`)
    }

    return this.executeResolved(method, path, resolvedRoute, post, requestSession)
  }

  private executeResolved(
    method: HttpMethod,
    path: string,
    resolvedRoute: ResolvedLlmRoute,
    post: Record<string, unknown>,
    requestSession: Record<string, unknown>,
  ): Promise<ForgeOutcome<unknown>> {
    const snapshot = this.snapshotFactory.create(method, path, resolvedRoute, requestSession, post)

    return this.options.forge.execute({ snapshot, renderer: this.renderer })
  }

  private readTurn(activeSession: ActiveSession, path: string, output: unknown, context: RenderContext): ActiveTurn {
    if (!this.isLlmTurnOutput(output)) {
      throw new Error(`Forge did not render an LLM turn for ${path}`)
    }

    const activeTurn = { path: this.normalizeUrl(path), turn: output }

    activeTurn.turn.questions.forEach(question => {
      activeSession.questionsByCode.set(question.code, { path: activeTurn.path, question })
    })
    Object.entries(context.answers).forEach(([code, answer]) => {
      if (this.isAnswerValue(answer)) {
        activeSession.recordedAnswers[code] = answer
      }
    })

    return activeTurn
  }

  private getPriorAnswers(activeSession: ActiveSession): readonly LlmPriorAnswer[] {
    const currentQuestionCodes = new Set(activeSession.activeTurn.turn.questions.map(question => question.code))

    return [...activeSession.questionsByCode.values()].flatMap(registeredQuestion => {
      const answer = activeSession.recordedAnswers[registeredQuestion.question.code]

      if (
        currentQuestionCodes.has(registeredQuestion.question.code) ||
        activeSession.answerRevisionByCode.get(registeredQuestion.question.code) ===
          activeSession.userMessageRevision ||
        !this.isAnswerValue(answer)
      ) {
        return []
      }

      return [{ ...registeredQuestion, answer }]
    })
  }

  private createActiveSessionPlaceholder(requestSession: Record<string, unknown>): ActiveSession {
    return {
      requestSession,
      conversation: new LlmConversation(this.options.supplier),
      activeTurn: { path: '', turn: { content: [], questions: [] } },
      presentedPaths: new Set<string>(),
      questionsByCode: new Map<string, LlmRegisteredQuestion>(),
      recordedAnswers: {},
      answerRevisionByCode: new Map<string, number>(),
      userMessageRevision: 0,
    }
  }

  private restoreActiveSession(session: LlmSession): ActiveSession {
    const restoredSession = structuredClone(session)

    return {
      requestSession: restoredSession.requestSession,
      conversation: new LlmConversation(this.options.supplier, restoredSession.messages),
      activeTurn: { path: restoredSession.currentPath, turn: restoredSession.currentTurn },
      presentedPaths: new Set(restoredSession.presentedPaths),
      questionsByCode: new Map(restoredSession.registeredQuestions.map(question => [question.question.code, question])),
      recordedAnswers: { ...restoredSession.recordedAnswers },
      answerRevisionByCode: new Map(Object.entries(restoredSession.answerRevisions)),
      userMessageRevision: restoredSession.userMessageRevision,
    }
  }

  private saveSession(conversationId: string, activeSession: ActiveSession): Promise<void> {
    const session: LlmSession = {
      requestSession: activeSession.requestSession,
      messages: activeSession.conversation.getMessages(),
      currentPath: activeSession.activeTurn.path,
      currentTurn: activeSession.activeTurn.turn,
      presentedPaths: [...activeSession.presentedPaths],
      registeredQuestions: [...activeSession.questionsByCode.values()],
      recordedAnswers: activeSession.recordedAnswers,
      answerRevisions: Object.fromEntries(activeSession.answerRevisionByCode),
      userMessageRevision: activeSession.userMessageRevision,
    }

    return this.options.sessionStore.set(conversationId, session)
  }

  private normalizePath(path: string): string {
    return new URL(path, this.origin).pathname
  }

  private normalizeUrl(path: string): string {
    const url = new URL(path, this.origin)

    return `${url.pathname}${url.search}`
  }

  private isLlmTurnOutput(output: unknown): output is LlmTurnOutput {
    if (!this.isRecord(output) || !Array.isArray(output.content) || !Array.isArray(output.questions)) {
      return false
    }

    const hasContent = output.content.every(
      item => this.isRecord(item) && item.kind === 'content' && typeof item.content === 'string',
    )
    const hasQuestions = output.questions.every(item => this.isLlmQuestionOutput(item))

    return hasContent && hasQuestions
  }

  private isLlmQuestionOutput(value: unknown): value is LlmQuestionOutput {
    if (
      !this.isRecord(value) ||
      typeof value.code !== 'string' ||
      typeof value.prompt !== 'string' ||
      !Array.isArray(value.errors) ||
      !value.errors.every(error => typeof error === 'string')
    ) {
      return false
    }

    if (value.kind === 'single-select' || value.kind === 'multi-select') {
      return Array.isArray(value.options)
    }

    return value.kind === 'date' || value.kind === 'free-text'
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  private isAnswerValue(value: unknown): value is LlmAnswerValue {
    return typeof value === 'string' || (Array.isArray(value) && value.every(item => typeof item === 'string'))
  }
}
