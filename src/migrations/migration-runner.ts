/**
 * Migration runner
 * Executes and tracks database migrations
 */

import type { DatabaseConnection, Result } from "../types.ts"

/**
 * Migration module interface for versioned database schema changes
 */
export interface MigrationModule {
  /** Function to apply the migration (create tables, add columns, etc.) */
  up: (db: DatabaseConnection) => void | Promise<void>
  /** Optional function to rollback the migration */
  down?: (db: DatabaseConnection) => void | Promise<void>
}

/**
 * Migration runner for managing database schema versioning
 */
export class MigrationRunner {
  private connection: DatabaseConnection
  private migrations: Map<string, MigrationModule>

  /**
   * Create a new migration runner
   * @param connection Database connection to run migrations on
   * @param migrations Record mapping version strings to migration modules
   */
  constructor(
    connection: DatabaseConnection,
    migrations: Record<string, MigrationModule>
  ) {
    this.connection = connection
    this.migrations = new Map(Object.entries(migrations))
  }

  /**
   * Initialize migration tracking table
   */
  async initialize(): Promise<Result<void>> {
    try {
      this.connection.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
          version TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at INTEGER NOT NULL,
          checksum TEXT NOT NULL
        )
      `)
      return { isError: false, value: undefined }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to initialize migrations table: ${error}`,
      }
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<Result<number>> {
    try {
      await this.initialize()

      const sortedVersions = Array.from(this.migrations.keys()).sort()
      let migratedCount = 0

      for (const version of sortedVersions) {
        const isApplied = this.connection.prepare(
          "SELECT 1 FROM _migrations WHERE version = ?"
        ).get(version)

        if (!isApplied) {
          const result = await this.runMigration(version)
          if (result.isError) {
            return result
          }
          migratedCount++
        }
      }

      return { isError: false, value: migratedCount }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to run migrations: ${error}`,
      }
    }
  }

  /**
   * Get migration status
   */
  async status(): Promise<Result<{
    applied: string[]
    pending: string[]
  }>> {
    try {
      await this.initialize()

      const stmt = this.connection.prepare("SELECT version FROM _migrations")
      const applied = (stmt.all() as { version: string }[]).map((r) => r.version)

      const allVersions = Array.from(this.migrations.keys())
      const pending = allVersions.filter((v) => !applied.includes(v))

      return {
        isError: false,
        value: {
          applied,
          pending,
        },
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to get status: ${error}`,
      }
    }
  }

  /**
   * Run a single migration
   * @private
   */
  private async runMigration(version: string): Promise<Result<void>> {
    try {
      const migration = this.migrations.get(version)

      if (!migration) {
        return {
          isError: true,
          error: `Migration not found: ${version}`,
        }
      }

      // Execute up migration
      if (migration.up) {
        await migration.up(this.connection)
      }

      // Record migration
      const now = Date.now()
      this.connection.prepare(
        `INSERT INTO _migrations (version, name, applied_at, checksum)
         VALUES (?, ?, ?, ?)`
      ).run(version, version, now, "")

      return { isError: false, value: undefined }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to run migration ${version}: ${error}`,
      }
    }
  }
}
