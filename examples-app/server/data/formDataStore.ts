import { RedisClient, createRedisClient } from './redisClient'
import logger from '../logger'
import config from '../config'

type FormAnswers = Record<string, unknown>

const KEY_PREFIX = 'form-data:'
const DEFAULT_TTL_SECONDS = 60 * 60 // 1 hour

// FORGE-EXAMPLE: A data store passed as a dependency to effects via registerPackage(pkg, deps).
// In a real service this would be an API client; here we use Redis as a simple stand-in.
export default class FormDataStore {
  private client: RedisClient

  private connectPromise: Promise<unknown> | undefined

  constructor(client?: RedisClient) {
    this.client = client ?? createRedisClient()
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connectPromise) {
      this.connectPromise = this.client.connect().catch(err => {
        this.connectPromise = undefined
        throw err
      })
    }

    await this.connectPromise
  }

  private getKey(sessionId: string, formCode: string): string {
    return `${KEY_PREFIX}${sessionId}:${formCode}`
  }

  async get(sessionId: string, formCode: string): Promise<FormAnswers | null> {
    if (!config.redis.enabled) {
      logger.warn('Redis not enabled, returning null for form data')

      return null
    }

    try {
      await this.ensureConnected()

      const data = await this.client.get(this.getKey(sessionId, formCode))

      if (!data) {
        return null
      }

      return JSON.parse(data.toString()) as FormAnswers
    } catch (error) {
      logger.error({ err: error, sessionId, formCode }, 'Failed to get form data')

      return null
    }
  }

  async set(sessionId: string, formCode: string, answers: FormAnswers): Promise<void> {
    if (!config.redis.enabled) {
      logger.warn('Redis not enabled, form data not persisted')

      return
    }

    try {
      await this.ensureConnected()

      const existing = await this.get(sessionId, formCode)
      const merged = { ...existing, ...answers }

      await this.client.set(this.getKey(sessionId, formCode), JSON.stringify(merged), {
        EX: DEFAULT_TTL_SECONDS,
      })
    } catch (error) {
      logger.error({ err: error, sessionId, formCode }, 'Failed to set form data')
    }
  }

  async delete(sessionId: string, formCode: string): Promise<void> {
    if (!config.redis.enabled) {
      return
    }

    try {
      await this.ensureConnected()

      await this.client.del(this.getKey(sessionId, formCode))
    } catch (error) {
      logger.error({ err: error, sessionId, formCode }, 'Failed to delete form data')
    }
  }
}
