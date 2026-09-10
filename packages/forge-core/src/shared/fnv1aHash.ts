/* eslint-disable no-bitwise -- FNV-1a is a bit-mixing hash */

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const MASK_64 = 0xffffffffffffffffn

/**
 * 64-bit FNV-1a hash of a string, returned as 16 hex characters.
 *
 * Pure JavaScript so it runs identically in Node and browsers - `node:crypto`
 * is unavailable in the browser and `crypto.subtle` is async. Used for content
 * fingerprints in generated script names, never for security.
 */
export const fnv1aHash = (input: string): string => {
  const bytes = new TextEncoder().encode(input)
  let hash = FNV_OFFSET_BASIS

  bytes.forEach(byte => {
    hash ^= BigInt(byte)
    hash = (hash * FNV_PRIME) & MASK_64
  })

  return hash.toString(16).padStart(16, '0')
}
