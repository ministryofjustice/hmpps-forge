type Contact = { recordName: string; recordEmail: string; recordDepartment: string }

/** In-memory stand-in for the API or database that owns contact records. */
export class AnswerStore {
  private readonly records = new Map<string, Contact>([
    ['0', { recordName: 'Jane Smith', recordEmail: 'jane.smith@example.com', recordDepartment: 'Digital Services' }],
    ['1', { recordName: 'John Doe', recordEmail: 'john.doe@example.com', recordDepartment: 'Policy' }],
    ['2', { recordName: 'Sarah Wilson', recordEmail: 'sarah.wilson@example.com', recordDepartment: 'Operations' }],
  ])

  async getAll(): Promise<Contact[]> {
    return structuredClone([...this.records.values()])
  }

  async get(recordId: string): Promise<Contact | undefined> {
    return structuredClone(this.records.get(recordId))
  }

  async save(recordId: string, contact: Contact): Promise<void> {
    this.records.set(recordId, structuredClone(contact))
  }
}
