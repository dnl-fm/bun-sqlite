/**
 * Base interface for ID value objects
 * Ensures consistent behavior across all ID types
 */

/**
 * Configuration options for ID generation
 */
export interface IdGenerationOptions {
  /**
   * Prefix to prepend to the ID
   * Example: 'user_', 'message_', 'post_'
   */
  prefix?: string
}

/**
 * Base interface for all ID value objects
 */
export interface Id {
  /**
   * Get the string representation of the ID
   */
  toString(): string

  /**
   * Check if this ID equals another ID
   */
  equals(other: Id | string): boolean

  /**
   * Validate that this ID is in the correct format
   */
  isValid(): boolean
}
