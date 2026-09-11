/** In-memory stand-in for the API or database that owns confirmed answers. */
export class AnswerStore {
  private answers: Record<string, unknown> | undefined

  async save(answers: Record<string, unknown>): Promise<void> {
    this.answers = structuredClone(answers)
  }

  async get(): Promise<Record<string, unknown> | undefined> {
    return structuredClone(this.answers)
  }

  async delete(): Promise<void> {
    this.answers = undefined
  }
}
