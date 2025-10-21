/**
 * ULID (Universally Unique Lexicographically Sortable Identifier)
 * Time-ordered, cryptographically random, 26 characters
 * Format: [prefix_]timestamp(10 chars) + randomness(16 chars)
 * Example: user_01ARZ3NDEKTSV4RRFFQ69G5FAV
 */

import type { Id, IdGenerationOptions } from "./id.ts"
import type { Result } from "../types.ts"

/**
 * Character set for ULID encoding (Crockford's base32)
 */
const ULID_CHARS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

/**
 * ULID implementation with time-sortability and cryptographic randomness
 */
export class Ulid implements Id {
  private readonly value: string
  private readonly prefix: string
  private readonly timestamp: number

  /**
   * Private constructor - use create() or fromString() instead
   */
  private constructor(value: string, prefix: string, timestamp: number) {
    this.value = value
    this.prefix = prefix
    this.timestamp = timestamp
  }

  /**
   * Create a new ULID with current timestamp
   * @param options - Generation options including optional prefix
   * @returns New ULID instance
   *
   * @example
   * const userId = Ulid.create({ prefix: "user_" })
   * // Returns: user_01ARZ3NDEKTSV4RRFFQ69G5FAV
   */
  static create(options?: IdGenerationOptions): Ulid {
    const prefix = options?.prefix ?? ""
    const timestamp = Date.now()

    // Encode timestamp (10 characters)
    const timestampStr = Ulid.encodeTimestamp(timestamp)

    // Generate random part (16 characters)
    const randomPart = Ulid.generateRandomPart(16)

    const ulidValue = timestampStr + randomPart
    const fullValue = prefix ? `${prefix}${ulidValue}` : ulidValue

    return new Ulid(fullValue, prefix, timestamp)
  }

  /**
   * Parse a ULID from string representation
   * @param value - String representation of ULID
   * @param options - Parsing options including optional expected prefix
   * @returns Result with Ulid instance or error message
   *
   * @example
   * const result = Ulid.fromString("user_01ARZ3NDEKTSV4RRFFQ69G5FAV", { prefix: "user_" })
   * if (!result.isError) {
   *   const ulid = result.value
   * }
   */
  static fromString(
    value: string,
    options?: { prefix?: string }
  ): Result<Ulid> {
    try {
      const prefix = options?.prefix ?? ""

      // Validate format
      if (typeof value !== "string" || value.length === 0) {
        return {
          isError: true,
          error: "ULID must be a non-empty string",
        }
      }

      // Check prefix if provided
      if (prefix && !value.startsWith(prefix)) {
        return {
          isError: true,
          error: `ULID must start with prefix: ${prefix}`,
        }
      }

      // Extract ULID part (without prefix)
      const ulidPart = prefix ? value.slice(prefix.length) : value

      // Validate ULID format: 26 characters
      if (ulidPart.length !== 26) {
        return {
          isError: true,
          error: `ULID must be 26 characters (got ${ulidPart.length})`,
        }
      }

      // Validate characters are valid
      for (const char of ulidPart) {
        if (!ULID_CHARS.includes(char)) {
          return {
            isError: true,
            error: `Invalid character in ULID: ${char}`,
          }
        }
      }

      // Extract and decode timestamp
      const timestampStr = ulidPart.slice(0, 10)
      const timestamp = Ulid.decodeTimestamp(timestampStr)

      if (timestamp < 0) {
        return {
          isError: true,
          error: "Invalid ULID timestamp",
        }
      }

      return {
        isError: false,
        value: new Ulid(value, prefix, timestamp),
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to parse ULID: ${error}`,
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
   * Validate ULID format
   */
  isValid(): boolean {
    if (this.value.length < 26) {
      return false
    }

    // Check prefix if present
    const ulidPart = this.prefix ? this.value.slice(this.prefix.length) : this.value

    if (ulidPart.length !== 26) {
      return false
    }

    // Check all characters are valid
    for (const char of ulidPart) {
      if (!ULID_CHARS.includes(char)) {
        return false
      }
    }

    return true
  }

  /**
   * Get the timestamp when this ULID was created
   * @returns Unix timestamp in milliseconds
   */
  getTimestamp(): number {
    return this.timestamp
  }

  /**
   * Get the prefix of this ULID
   */
  getPrefix(): string {
    return this.prefix
  }

  /**
   * Encode timestamp to base32 string (10 characters)
   * Encodes milliseconds since epoch
   */
  private static encodeTimestamp(timestamp: number): string {
    const chars: string[] = []

    // Encode 48-bit timestamp into 10 base32 characters
    for (let i = 0; i < 10; i++) {
      const index = Math.floor(timestamp / 32 ** (9 - i)) % 32
      chars.push(ULID_CHARS[index] ?? "")
    }

    return chars.join("")
  }

  /**
   * Decode timestamp from base32 string
   */
  private static decodeTimestamp(timestampStr: string): number {
    let timestamp = 0

    for (let i = 0; i < 10; i++) {
      const index = ULID_CHARS.indexOf(timestampStr[i] ?? "")
      if (index === -1) {
        return -1
      }

      timestamp = timestamp * 32 + index
    }

    return timestamp
  }

  /**
   * Generate cryptographically random part (16 characters)
   */
  private static generateRandomPart(length: number): string {
    const bytes = crypto.getRandomValues(new Uint8Array(length))
    let result = ""

    for (const byte of bytes) {
      result += ULID_CHARS[byte % 32]
    }

    return result
  }
}
