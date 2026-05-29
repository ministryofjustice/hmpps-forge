import { HrTime } from './types'

const NANOS_PER_SECOND = 1e9
const NANOS_PER_MILLI = 1e6
const MILLIS_PER_SECOND = 1000

export function millisToHrTime(epochMillis: number): HrTime {
  const seconds = Math.trunc(epochMillis / MILLIS_PER_SECOND)
  const nanos = Math.round((epochMillis - seconds * MILLIS_PER_SECOND) * NANOS_PER_MILLI)

  if (nanos === NANOS_PER_SECOND) {
    return [seconds + 1, 0]
  }

  return [seconds, nanos]
}

export function hrTimeDuration(start: HrTime, end: HrTime): HrTime {
  const seconds = end[0] - start[0]
  const nanos = end[1] - start[1]

  if (nanos < 0) {
    return [seconds - 1, nanos + NANOS_PER_SECOND]
  }

  return [seconds, nanos]
}
