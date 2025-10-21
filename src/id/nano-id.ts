/**
 * NanoID - Cryptographically secure, URL-safe unique identifier
 * Format: [prefix_]random(21 chars by default)
 * Example: user_V1StGXR8_Z5jdHi6B-myT
 *
 * Not time-sortable, but smaller and simpler than ULID
 */

import type { Id, IdGenerationOptions } from "./id.ts"
import type { Result } from "../types.ts"

/**
 * URL-safe character set for NanoID (no special chars that need escaping)
 */
const NANOID_CHARS = "_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

/**
 * NanoID implementation with cryptographic randomness
 */
export class NanoId implements Id {
  private readonly value: string
  private readonly prefix: string
  private readonly randomPart: string

  /**
   * Default length for the random part (21 chars gives ~126-bit entropy)
   */
  static readonly DEFAULT_LENGTH = 21

  /**
   * Private constructor - use create() or fromString() instead
   */
  private constructor(value: string, prefix: string, randomPart: string) {
    this.value = value
    this.prefix = prefix
    this.randomPart = randomPart
  }

  /**
   * Create a new NanoID with random value
   * @param options - Generation options including optional prefix and length
   * @returns New NanoID instance
   *
   * @example
   * const messageId = NanoId.create({ prefix: "message_" })
   * // Returns: message_V1StGXR8_Z5jdHi6B-myT
   *
   * @example
   * const shortId = NanoId.create({ prefix: "id_", length: 12 })
   * // Returns: id_a1B2c3D4e5F6
   */
  static create(options?: IdGenerationOptions & { length?: number }): NanoId {
    const prefix = options?.prefix ?? ""
    const length = options?.length ?? NanoId.DEFAULT_LENGTH

    const randomPart = NanoId.generateRandom(length)
    const fullValue = prefix ? `${prefix}${randomPart}` : randomPart

    return new NanoId(fullValue, prefix, randomPart)
  }

  /**
   * Parse a NanoID from string representation
   * @param value - String representation of NanoID
   * @param options - Parsing options including optional expected prefix
   * @returns Result with NanoId instance or error message
   *
   * @example
   * const result = NanoId.fromString("user_V1StGXR8_Z5jdHi6B-myT", { prefix: "user_" })
   * if (!result.isError) {
   *   const nanoid = result.value
   * }
   */
  static fromString(
    value: string,
    options?: { prefix?: string }
  ): Result<NanoId> {
    try {
      const prefix = options?.prefix ?? ""

      // Validate format
      if (typeof value !== "string" || value.length === 0) {
        return {
          isError: true,
          error: "NanoID must be a non-empty string",
        }
      }

      // Check prefix if provided
      if (prefix && !value.startsWith(prefix)) {
        return {
          isError: true,
          error: `NanoID must start with prefix: ${prefix}`,
        }
      }

      // Extract random part (without prefix)
      const randomPart = prefix ? value.slice(prefix.length) : value

      // Validate all characters are valid
      for (const char of randomPart) {
        if (!NANOID_CHARS.includes(char)) {
          return {
            isError: true,
            error: `Invalid character in NanoID: ${char}`,
          }
        }
      }

      return {
        isError: false,
        value: new NanoId(value, prefix, randomPart),
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to parse NanoID: ${error}`,
      }
    }
  }

  /**
   * Get the string representation
   */
  toString(): string {
    return this.value
  }

  /**
   * Check equality with another ID
   */
  equals(other: Id | string): boolean {
    const otherValue = typeof other === "string" ? other : other.toString()
    return this.value === otherValue
  }

  /**
   * Validate NanoID format
   */
  isValid(): boolean {
    if (this.value.length === 0) {
      return false
    }

    // Extract random part
    const randomPart = this.prefix ? this.value.slice(this.prefix.length) : this.value

    if (randomPart.length === 0) {
      return false
    }

    // Check all characters are valid
    for (const char of randomPart) {
      if (!NANOID_CHARS.includes(char)) {
        return false
      }
    }

    return true
  }

  /**
   * Get the prefix of this NanoID
   */
  getPrefix(): string {
    return this.prefix
  }

  /**
   * Get the random part (without prefix)
   */
  getRandomPart(): string {
    return this.randomPart
  }

  /**
   * Generate cryptographically random string
   */
  private static generateRandom(length: number): string {
    const bytes = crypto.getRandomValues(new Uint8Array(length))
    let result = ""

    // Use modulo to get index into NANOID_CHARS
    for (const byte of bytes) {
      result += NANOID_CHARS[byte % NANOID_CHARS.length]
    }

    return result
  }
}
