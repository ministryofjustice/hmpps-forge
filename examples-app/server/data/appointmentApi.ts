import logger from '../logger'

export interface AppointmentSlot {
  time: string
  available: boolean
}

/**
 * Simple string hash that produces a deterministic number from any input.
 * Used to seed which appointment slots are available.
 */
function hashSeed(input: string): number {
  let hash = 0

  for (let i = 0; i < input.length; i += 1) {
    const char = input.charCodeAt(i)
    // eslint-disable-next-line no-bitwise
    hash = (hash * 31 + char) | 0
  }

  return Math.abs(hash)
}

/**
 * Generates 30-minute appointment slots from 09:00 to 16:30.
 * Uses the seed to deterministically mark slots as available or unavailable.
 */
function generateSlots(seed: number): AppointmentSlot[] {
  const slots: AppointmentSlot[] = []

  for (let hour = 9; hour <= 16; hour += 1) {
    for (const minutes of [0, 30]) {
      if (hour === 16 && minutes === 30) {
        break
      }

      const slotSeed = hashSeed(`${seed}-${hour}-${minutes}`)
      const available = slotSeed % 10 < 3

      slots.push({
        time: `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        available,
      })
    }
  }

  return slots
}

// This is a pseudo API that simulates fetching appointment availability.
// It generates deterministic time slots seeded by the input parameters, so the same
// date/location always returns the same results. In a real service, this would call
// an external booking API.
export default class AppointmentApi {
  async getVirtualSlots(date: string): Promise<AppointmentSlot[]> {
    logger.info(`AppointmentApi: fetching virtual slots for ${date}`)

    const seed = hashSeed(`virtual:${date}`)
    const slots = generateSlots(seed)

    return slots.filter(slot => slot.available)
  }

  async getInPersonSlots(location: string, date: string): Promise<AppointmentSlot[]> {
    logger.info(`AppointmentApi: fetching in-person slots for ${location} on ${date}`)

    const seed = hashSeed(`in-person:${location}:${date}`)
    const slots = generateSlots(seed)

    return slots.filter(slot => slot.available)
  }
}
