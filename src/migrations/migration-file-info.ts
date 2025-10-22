/**
 * Migration file information value object
 * Parses and validates migration filenames with timestamp-based versioning
 *
 * Expected format: YYYYMMDDTHHMMSS_description.ts
 * Example: 20251022T143045_create_users.ts
 */

import type { Result } from "../types.ts"

/**
 * Represents metadata about a migration file
 * Guarantees: filename matches timestamp pattern, valid ISO datetime, immutable
 */
export class MigrationFileInfo {
  private readonly fileName: string
  private readonly filePath: string
  private readonly version: string
  private readonly description: string

  /**
   * Private constructor - use fromFileName() instead
   * @param fileName Original filename
   * @param filePath Full path to the file
   * @param version Timestamp version string (YYYYMMDDTHHMMSS)
   * @param description Migration description extracted from filename
   */
  private constructor(fileName: string, filePath: string, version: string, description: string) {
    this.fileName = fileName
    this.filePath = filePath
    this.version = version
    this.description = description
  }

  /**
   * Parse and validate a migration filename
   *
   * @param fileName Migration filename to parse (e.g., "20251022T143045_create_users.ts")
   * @param dirPath Directory path where the file is located
   * @returns Result with MigrationFileInfo instance or error message
   *
   * @example
   * const result = MigrationFileInfo.fromFileName("20251022T143045_create_users.ts", "./migrations")
   * if (!result.isError) {
   *   console.log(result.value.getVersion()) // "20251022T143045"
   * }
   */
  static fromFileName(fileName: string, dirPath: string): Result<MigrationFileInfo> {
    // Validate filename format: YYYYMMDDTHHMMSS_description.ts
    const pattern = /^(\d{8}T\d{6})_([a-z0-9_]+)\.ts$/
    const match = fileName.match(pattern)

    if (!match) {
      return {
        isError: true,
        error: `Invalid migration filename: "${fileName}"\nExpected format: YYYYMMDDTHHMMSS_description.ts\nExample: 20251022T143045_create_users.ts`,
      }
    }

    const version = match[1]
    const description = match[2]

    if (!version || !description) {
      return {
        isError: true,
        error: `Invalid migration filename: "${fileName}"\nExpected format: YYYYMMDDTHHMMSS_description.ts`,
      }
    }

    // Validate timestamp format (YYYYMMDDTHHMMSS)
    const timestampValidation = MigrationFileInfo.validateTimestamp(version)
    if (timestampValidation.isError) {
      return {
        isError: true,
        error: `Invalid timestamp in migration filename: "${fileName}"\n${timestampValidation.error}`,
      }
    }

    const filePath = dirPath.endsWith("/") ? `${dirPath}${fileName}` : `${dirPath}/${fileName}`

    return {
      isError: false,
      value: new MigrationFileInfo(fileName, filePath, version, description),
    }
  }

  /**
   * Validate ISO timestamp format (YYYYMMDDTHHMMSS)
   * Ensures the timestamp represents a valid date and time
   * @private
   */
  private static validateTimestamp(timestamp: string): Result<void> {
    // Format: YYYYMMDDTHHMMSS
    if (timestamp.length !== 15 || timestamp[8] !== "T") {
      return {
        isError: true,
        error: "Timestamp must be in format YYYYMMDDTHHMMSS",
      }
    }

    const year = parseInt(timestamp.substring(0, 4), 10)
    const month = parseInt(timestamp.substring(4, 6), 10)
    const day = parseInt(timestamp.substring(6, 8), 10)
    const hour = parseInt(timestamp.substring(9, 11), 10)
    const minute = parseInt(timestamp.substring(11, 13), 10)
    const second = parseInt(timestamp.substring(13, 15), 10)

    // Validate date components
    if (month < 1 || month > 12) {
      return {
        isError: true,
        error: `Invalid month: ${month}. Must be between 01 and 12.`,
      }
    }

    const daysInMonth = new Date(year, month, 0).getDate()
    if (day < 1 || day > daysInMonth) {
      return {
        isError: true,
        error: `Invalid day: ${day}. Month ${month} has maximum ${daysInMonth} days.`,
      }
    }

    // Validate time components
    if (hour < 0 || hour > 23) {
      return {
        isError: true,
        error: `Invalid hour: ${hour}. Must be between 00 and 23.`,
      }
    }

    if (minute < 0 || minute > 59) {
      return {
        isError: true,
        error: `Invalid minute: ${minute}. Must be between 00 and 59.`,
      }
    }

    if (second < 0 || second > 59) {
      return {
        isError: true,
        error: `Invalid second: ${second}. Must be between 00 and 59.`,
      }
    }

    return { isError: false, value: undefined }
  }

  /**
   * Get the migration version (timestamp string)
   * @returns Version string in format YYYYMMDDTHHMMSS
   */
  getVersion(): string {
    return this.version
  }

  /**
   * Get the migration description extracted from filename
   * @returns Description string (lowercase alphanumeric and underscores)
   */
  getDescription(): string {
    return this.description
  }

  /**
   * Get the original migration filename
   * @returns Filename (e.g., "20251022T143045_create_users.ts")
   */
  getFileName(): string {
    return this.fileName
  }

  /**
   * Get the full file path
   * @returns Absolute or relative file path
   */
  getFilePath(): string {
    return this.filePath
  }

  /**
   * Check equality with another MigrationFileInfo
   * @param other Other MigrationFileInfo to compare
   * @returns true if versions and filenames match
   */
  equals(other: MigrationFileInfo): boolean {
    return this.version === other.version && this.fileName === other.fileName
  }

  /**
   * Get string representation for logging/debugging
   * @returns Formatted string
   */
  toString(): string {
    return `${this.version} - ${this.description} (${this.fileName})`
  }
}
