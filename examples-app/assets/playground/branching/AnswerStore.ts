/** In-memory stand-in for the API or database that owns confirmed answers. */
export class AnswerStore {
  private readonly records = new Map<string, Record<string, unknown>>()

  async save(recordId: string, answers: Record<string, unknown>): Promise<void> {
    this.records.set(recordId, structuredClone(answers))
  }

  async get(recordId: string): Promise<Record<string, unknown> | undefined> {
    return structuredClone(this.records.get(recordId))
  }

  async delete(recordId: string): Promise<void> {
    this.records.delete(recordId)
  }
}
