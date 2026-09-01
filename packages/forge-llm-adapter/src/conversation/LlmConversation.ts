import type { LlmQuestionOutput, LlmTurnOutput } from '../functions/renderers/turn/llmTurn'

export type LlmAnswerValue = string | readonly string[]

export interface LlmMessage {
  readonly role: 'assistant' | 'user'
  readonly content: string
}

export interface LlmResolveTurnRequest {
  readonly turn: LlmTurnOutput
  readonly messages: readonly LlmMessage[]
  readonly priorAnswers: readonly LlmPriorAnswer[]
}

export interface LlmClarifyTurnRequest {
  readonly turn: LlmTurnOutput
  readonly messages: readonly LlmMessage[]
}

export interface LlmInteraction {
  readonly kind: 'answer' | 'clarification'
  readonly message?: string
}

export interface LlmProposedAnswers {
  readonly answers: Readonly<Record<string, LlmAnswerValue>>
  readonly amendments?: Readonly<Record<string, LlmAnswerValue>>
  readonly interaction?: LlmInteraction
}

export interface LlmPriorAnswer {
  readonly path: string
  readonly question: LlmQuestionOutput
  readonly answer: LlmAnswerValue
}

export interface LlmAnswerAmendment {
  readonly path: string
  readonly code: string
  readonly answer: LlmAnswerValue
}

/** Implemented by an OpenAI, Copilot, or other model provider integration. */
export interface LlmSupplier {
  resolveTurn(request: LlmResolveTurnRequest): Promise<LlmProposedAnswers>
  clarifyTurn?(request: LlmClarifyTurnRequest): Promise<string>
}

export interface LlmTurnResolution {
  readonly answers: Readonly<Record<string, LlmAnswerValue>>
  readonly amendments: readonly LlmAnswerAmendment[]
  readonly unresolved: readonly string[]
  readonly complete: boolean
  readonly interaction?: LlmInteraction
}

/** Retains a conversation and resolves newly revealed Forge questions from it. */
export class LlmConversation {
  private readonly messages: LlmMessage[]

  constructor(
    private readonly supplier: LlmSupplier,
    messages: readonly LlmMessage[] = [],
  ) {
    this.messages = [...messages]
  }

  addAssistantMessage(content: string): void {
    this.messages.push({ role: 'assistant', content })
  }

  addUserMessage(content: string): void {
    this.messages.push({ role: 'user', content })
  }

  getMessages(): readonly LlmMessage[] {
    return [...this.messages]
  }

  async clarifyTurn(turn: LlmTurnOutput): Promise<string | undefined> {
    return this.supplier.clarifyTurn?.({ turn, messages: this.getMessages() })
  }

  async resolveTurn(turn: LlmTurnOutput, priorAnswers: readonly LlmPriorAnswer[] = []): Promise<LlmTurnResolution> {
    const proposedAnswers = await this.supplier.resolveTurn({ turn, priorAnswers, messages: this.getMessages() })
    const questionCodes = turn.questions.map(question => question.code)
    const answers = Object.fromEntries(
      turn.questions.flatMap(question => {
        const answer = proposedAnswers.answers[question.code]

        return answer !== undefined && this.isValidAnswer(question, answer) ? [[question.code, answer]] : []
      }),
    )
    const amendments = priorAnswers.flatMap(priorAnswer => {
      const answer = proposedAnswers.amendments?.[priorAnswer.question.code]

      if (
        answer === undefined ||
        !this.isValidAnswer(priorAnswer.question, answer) ||
        this.isSameAnswer(answer, priorAnswer.answer)
      ) {
        return []
      }

      return [{ path: priorAnswer.path, code: priorAnswer.question.code, answer }]
    })
    const unresolved = questionCodes.filter(code => answers[code] === undefined)

    return {
      answers,
      amendments,
      unresolved,
      complete: unresolved.length === 0,
      ...(proposedAnswers.interaction === undefined ? {} : { interaction: proposedAnswers.interaction }),
    }
  }

  async buildPrompt(turn: LlmTurnOutput, includeContent: boolean): Promise<string> {
    const fallbackPrompt = this.buildDeterministicPrompt(turn, includeContent)
    const hasValidationErrors = turn.questions.some(question => question.errors.length > 0)

    if (!hasValidationErrors) {
      return fallbackPrompt
    }

    try {
      const clarification = await this.clarifyTurn(turn)

      if (clarification === undefined) {
        return fallbackPrompt
      }

      return [...this.getContent(turn, includeContent), clarification].join('\n\n')
    } catch {
      return fallbackPrompt
    }
  }

  private isValidAnswer(question: LlmQuestionOutput, answer: LlmAnswerValue): boolean {
    if (question.kind === 'multi-select') {
      return Array.isArray(answer) &&
        new Set(answer).size === answer.length &&
        answer.every(value => question.options.some(option => option.value === value))
    }

    if (typeof answer !== 'string' || answer.trim().length === 0) {
      return false
    }

    if (question.kind === 'single-select') {
      return question.options.some(option => option.value === answer)
    }

    return true
  }

  private isSameAnswer(first: LlmAnswerValue, second: LlmAnswerValue): boolean {
    if (typeof first === 'string' || typeof second === 'string') {
      return first === second
    }

    return first.length === second.length && first.every((value, index) => value === second[index])
  }

  private buildDeterministicPrompt(turn: LlmTurnOutput, includeContent: boolean): string {
    const content = this.getContent(turn, includeContent)
    const failedQuestions = turn.questions.filter(question => question.errors.length > 0)
    const questions = failedQuestions.length > 0 || content.length > 0 ? failedQuestions : turn.questions
    const prompts = questions.map(question => this.formatQuestion(question))

    if (prompts.length === 0) {
      return content.join('\n\n')
    }

    if (prompts.length === 1) {
      return [...content, prompts[0]].join('\n\n')
    }

    return [...content, 'Could you tell me a little more about these?', ...prompts.map(prompt => `- ${prompt}`)].join(
      '\n',
    )
  }

  private getContent(turn: LlmTurnOutput, includeContent: boolean): string[] {
    return includeContent ? turn.content.map(item => item.content) : []
  }

  private formatQuestion(question: LlmQuestionOutput): string {
    const prompt = question.errors[0] ?? question.prompt

    if (question.kind !== 'single-select' && question.kind !== 'multi-select') {
      return prompt
    }

    const options = question.options.map(option => option.text).join(', ')
    const punctuatedPrompt = /[.!?]$/.test(prompt) ? prompt : `${prompt}.`

    return `${punctuatedPrompt} Some possibilities are ${options}.`
  }
}
