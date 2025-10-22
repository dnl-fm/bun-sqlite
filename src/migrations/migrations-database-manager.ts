/**
 * Migrations database manager
 * Manages separate .migrations.db file for tracking applied migrations
 *
 * This keeps migration history separate from the application database,
 * allowing migrations to be tracked independently and safely.
 */

import { Database as BunDatabase } from "bun:sqlite"
import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import type { Result } from "../types.ts"

/**
 * Manages a separate SQLite database for tracking applied migrations
 *
 * Responsibilities:
 * - Create and initialize .migrations.db if needed
 * - Maintain _migrations_applied table
 * - Record when migrations are applied
 * - Query migration status and history
 */
export class MigrationsDatabaseManager {
  private migrationsDbPath: string
  private connection: BunDatabase | null = null

  /**
   * Create a new migrations database manager
   *
   * @param migrationsDbPath Path to the .migrations.db file
   *
   * @example
   * const manager = new MigrationsDatabaseManager("./.migrations.db")
   * await manager.initialize()
   */
  constructor(migrationsDbPath: string) {
    this.migrationsDbPath = migrationsDbPath
  }

  /**
   * Initialize the migrations database and create the tracking table
   *
   * Creates the .migrations.db file if it doesn't exist, creates the
   * _migrations_applied table if needed, and enables WAL mode for safety.
   *
   * @returns Result indicating success or error
   */
  async initialize(): Promise<Result<void>> {
    try {
      // Ensure directory exists
      const dir = dirname(this.migrationsDbPath)
      if (dir !== "." && !existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }

      // Open or create database
      this.connection = new BunDatabase(this.migrationsDbPath)

      // Enable WAL mode for safety and performance
      this.connection.exec("PRAGMA journal_mode = WAL")

      // Create migrations tracking table
      this.connection.exec(`
        CREATE TABLE IF NOT EXISTS _migrations_applied (
          version TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at INTEGER NOT NULL,
          checksum TEXT
        )
      `)

      return { isError: false, value: undefined }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to initialize migrations database: ${error}`,
      }
    }
  }

  /**
   * Record that a migration has been applied
   *
   * @param version Migration version string (timestamp)
   * @param description Migration description
   * @returns Result indicating success or error
   *
   * @example
   * const result = await manager.recordApplied("20251022T143045", "create_users")
   */
  async recordApplied(version: string, description: string): Promise<Result<void>> {
    try {
      if (!this.connection) {
        return {
          isError: true,
          error: "Migrations database not initialized. Call initialize() first.",
        }
      }

      const now = Date.now()
      const checksum = "" // Future enhancement for checksum verification

      const stmt = this.connection.prepare(`
        INSERT INTO _migrations_applied (version, description, applied_at, checksum)
        VALUES (?, ?, ?, ?)
      `)

      stmt.run(version, description, now, checksum)

      return { isError: false, value: undefined }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to record applied migration: ${error}`,
      }
    }
  }

  /**
   * Get all applied migration versions
   *
   * @returns Result with array of applied version strings or error
   *
   * @example
   * const result = await manager.getApplied()
   * if (!result.isError) {
   *   console.log(result.value) // ["20251022T143045", "20251022T143046"]
   * }
   */
  async getApplied(): Promise<Result<string[]>> {
    try {
      if (!this.connection) {
        return {
          isError: true,
          error: "Migrations database not initialized. Call initialize() first.",
        }
      }

      const stmt = this.connection.prepare("SELECT version FROM _migrations_applied ORDER BY applied_at ASC")
      const rows = stmt.all() as { version: string }[]

      return {
        isError: false,
        value: rows.map(row => row.version),
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to get applied migrations: ${error}`,
      }
    }
  }

  /**
   * Get migration status (applied vs pending)
   *
   * @param allVersions Array of all available migration versions
   * @returns Result with status object containing applied and pending arrays
   *
   * @example
   * const result = await manager.getStatus(["20251022T143045", "20251022T143046"])
   * if (!result.isError) {
   *   console.log(result.value)
   *   // { applied: ["20251022T143045"], pending: ["20251022T143046"] }
   * }
   */
  async getStatus(allVersions: string[]): Promise<
    Result<{
      applied: string[]
      pending: string[]
    }>
  > {
    try {
      const appliedResult = await this.getApplied()

      if (appliedResult.isError) {
        return appliedResult
      }

      const applied = appliedResult.value
      const pending = allVersions.filter(v => !applied.includes(v))

      return {
        isError: false,
        value: { applied, pending },
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to get migration status: ${error}`,
      }
    }
  }

  /**
   * Close the migrations database connection
   *
   * Should be called before application shutdown to ensure
   * all pending writes are flushed.
   */
  close(): void {
    if (this.connection) {
      this.connection.close()
      this.connection = null
    }
  }
}
