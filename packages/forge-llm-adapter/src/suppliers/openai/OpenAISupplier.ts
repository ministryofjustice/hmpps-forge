import OpenAI from 'openai'
import type { EasyInputMessage, ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses'
import type { ReasoningEffort } from 'openai/resources/shared'
import { z } from 'zod'

import type {
  LlmAnswerValue,
  LlmClarifyTurnRequest,
  LlmProposedAnswers,
  LlmResolveTurnRequest,
  LlmSupplier,
} from '../../conversation/LlmConversation'
import type { LlmQuestionOutput } from '../../functions/renderers/turn/llmTurn'

const proposedAnswersSchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.null()])),
  amendments: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.null()])),
  interaction: z.object({
    kind: z.enum(['answer', 'clarification']),
    message: z.string().nullable(),
  }),
})

const clarificationSchema = z.object({ message: z.string() })

export type OpenAIReasoningEffort = Exclude<ReasoningEffort, null>

export interface OpenAISupplierOptions {
  readonly apiKey?: string
  readonly model?: ResponseCreateParamsNonStreaming['model']
  readonly reasoningEffort?: OpenAIReasoningEffort
}

export interface OpenAIResponsesClient {
  readonly responses: {
    create(request: ResponseCreateParamsNonStreaming): Promise<{ readonly output_text: string }>
  }
}

/** Resolves Forge turns through the OpenAI Responses API. */
export class OpenAISupplier implements LlmSupplier {
  constructor(
    private readonly options: OpenAISupplierOptions = {},
    private readonly client: OpenAIResponsesClient = new OpenAI({ apiKey: options.apiKey }),
  ) {}

  async resolveTurn(request: LlmResolveTurnRequest): Promise<LlmProposedAnswers> {
    const response = await this.client.responses.create({
      model: this.options.model ?? 'gpt-5.6-luna',
      reasoning: { effort: this.options.reasoningEffort ?? 'none' },
      instructions: this.buildInstructions(),
      input: this.buildInput(request),
      text: {
        format: {
          type: 'json_schema',
          name: 'forge_turn_answers',
          description: 'Answers inferred for the current Forge turn.',
          schema: this.buildOutputSchema(request),
          strict: true,
        },
        verbosity: 'low',
      },
      store: false,
    })
    const parsed = this.parseResponse(response.output_text)
    const answers = this.omitNullValues(parsed.answers)
    const amendments = this.omitNullValues(parsed.amendments)

    return {
      answers,
      amendments,
      interaction: {
        kind: parsed.interaction.kind,
        ...(parsed.interaction.message === null ? {} : { message: parsed.interaction.message }),
      },
    }
  }

  async clarifyTurn(request: LlmClarifyTurnRequest): Promise<string> {
    const response = await this.client.responses.create({
      model: this.options.model ?? 'gpt-5.6-luna',
      reasoning: { effort: this.options.reasoningEffort ?? 'none' },
      instructions: this.buildClarificationInstructions(),
      input: this.buildClarificationInput(request),
      text: {
        format: {
          type: 'json_schema',
          name: 'forge_turn_clarification',
          description: 'A conversational explanation of Forge validation feedback.',
          schema: {
            type: 'object',
            properties: { message: { type: 'string' } },
            required: ['message'],
            additionalProperties: false,
          },
          strict: true,
        },
        verbosity: 'low',
      },
      store: false,
    })

    return this.parseClarification(response.output_text)
  }

  private buildInstructions(): string {
    return [
      'Resolve the current Forge questions using only information the user has already provided.',
      'When the journey reveals new questions, reuse relevant facts from earlier user messages even when the user supplied them before those questions were asked.',
      'Return null for any question that cannot be answered without asking the user.',
      'A refusal or a decision not to provide information is not an answer; return null rather than storing the refusal as free text.',
      "Choose a selection option only when the user's words distinguish it from the other available options. Do not choose an option merely because it is plausible or commonly associated with another detail.",
      'For selection questions, return only the supplied option values.',
      "Follow each question's llmHint when one is supplied. It is private guidance for interpreting and formatting the answer, not text shown to the user.",
      "Use a question's llmClarificationHint only when the user explicitly asks what the question means or asks for it to be rephrased.",
      'For date questions, preserve the precision the user supplied unless its llmHint requires a particular representation.',
      'Return an amendment only when the most recent user message explicitly corrects or replaces a previously recorded answer.',
      'Do not amend an answer merely because the user mentions a hypothetical, a future preference, or additional compatible detail.',
      'Return null for every prior answer that the user has not explicitly changed.',
      'Set interaction.kind to clarification only when the latest user message shows they do not understand a current question and provides no answer to it.',
      'For a clarification, write one brief, natural message which rephrases the unanswered question without weakening it or inventing an answer.',
      'Otherwise set interaction.kind to answer and interaction.message to null.',
    ].join('\n')
  }

  private buildClarificationInstructions(): string {
    return [
      'Turn Forge validation feedback into one brief, natural conversational response.',
      'Forge validation is authoritative. Preserve its meaning and do not relax the requirement.',
      'Do not silently repair, reinterpret, or infer a replacement for the value the user supplied.',
      'Briefly explain an obvious mistake when that would help, then ask the failed question again.',
      "Follow each failed question's llmClarificationHint when one is supplied. It is private author guidance and must not be quoted or mentioned.",
      'Do not use llmHint as clarification guidance.',
      'Mention only questions that have validation errors.',
    ].join('\n')
  }

  private buildInput(request: LlmResolveTurnRequest): EasyInputMessage[] {
    return [
      {
        role: 'developer',
        content: [
          `Current date: ${new Date().toISOString().slice(0, 10)}`,
          `Current Forge turn:\n${JSON.stringify(request.turn)}`,
          `Previously recorded Forge answers:\n${JSON.stringify(request.priorAnswers)}`,
        ].join('\n\n'),
      },
      ...request.messages.map(message => ({
        role: message.role,
        content: message.content,
      })),
    ]
  }

  private buildClarificationInput(request: LlmClarifyTurnRequest): EasyInputMessage[] {
    return [
      {
        role: 'developer',
        content: `Forge turn containing validation errors:\n${JSON.stringify(request.turn)}`,
      },
      ...request.messages.map(message => ({
        role: message.role,
        content: message.content,
      })),
    ]
  }

  private buildOutputSchema(request: LlmResolveTurnRequest): Readonly<Record<string, unknown>> {
    const answerProperties = Object.fromEntries(
      request.turn.questions.map(question => [question.code, this.buildQuestionSchema(question)]),
    )
    const amendmentProperties = Object.fromEntries(
      request.priorAnswers.map(priorAnswer => [
        priorAnswer.question.code,
        this.buildQuestionSchema(priorAnswer.question),
      ]),
    )

    return {
      type: 'object',
      properties: {
        answers: {
          type: 'object',
          properties: answerProperties,
          required: request.turn.questions.map(question => question.code),
          additionalProperties: false,
        },
        amendments: {
          type: 'object',
          properties: amendmentProperties,
          required: request.priorAnswers.map(priorAnswer => priorAnswer.question.code),
          additionalProperties: false,
        },
        interaction: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['answer', 'clarification'] },
            message: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          required: ['kind', 'message'],
          additionalProperties: false,
        },
      },
      required: ['answers', 'amendments', 'interaction'],
      additionalProperties: false,
    }
  }

  private buildQuestionSchema(question: LlmQuestionOutput): Readonly<Record<string, unknown>> {
    if (question.kind === 'multi-select') {
      return {
        ...(question.llmHint === undefined ? {} : { description: question.llmHint }),
        anyOf: [
          {
            type: 'array',
            items: {
              type: 'string',
              enum: question.options.map(option => option.value),
            },
          },
          { type: 'null' },
        ],
      }
    }

    if (question.kind === 'single-select') {
      return {
        ...(question.llmHint === undefined ? {} : { description: question.llmHint }),
        anyOf: [
          {
            type: 'string',
            enum: question.options.map(option => option.value),
          },
          { type: 'null' },
        ],
      }
    }

    return {
      ...(question.llmHint === undefined ? {} : { description: question.llmHint }),
      anyOf: [{ type: 'string' }, { type: 'null' }],
    }
  }

  private parseResponse(outputText: string): z.infer<typeof proposedAnswersSchema> {
    if (!outputText) {
      throw new Error('OpenAI returned no structured output')
    }

    try {
      return proposedAnswersSchema.parse(JSON.parse(outputText))
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error))

      throw new Error('OpenAI returned invalid structured output', { cause })
    }
  }

  private parseClarification(outputText: string): string {
    if (!outputText) {
      throw new Error('OpenAI returned no clarification output')
    }

    try {
      return clarificationSchema.parse(JSON.parse(outputText)).message
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error))

      throw new Error('OpenAI returned invalid clarification output', { cause })
    }
  }

  private omitNullValues(values: Record<string, string | string[] | null>): Record<string, LlmAnswerValue> {
    return Object.fromEntries(
      Object.entries(values).filter((entry): entry is [string, string | string[]] => entry[1] !== null),
    )
  }
}
