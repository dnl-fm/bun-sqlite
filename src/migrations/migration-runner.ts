/**
 * Migration runner
 * Executes and tracks database migrations
 *
 * Uses a separate migrations.db file to track applied migrations,
 * keeping migration history independent from the application database.
 */

import type { DatabaseConnection, Result } from "../types.ts"
import { MigrationsDatabaseManager } from "./migrations-database-manager.ts"

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
 * Migration runner options
 */
export interface MigrationRunnerOptions {
  /** Path to migrations database file (default: "./.migrations.db") */
  migrationsDbPath?: string
}

/**
 * Migration runner for managing database schema versioning
 */
export class MigrationRunner {
  private connection: DatabaseConnection
  private migrations: Map<string, MigrationModule>
  private migrationsDb: MigrationsDatabaseManager
  private migrationsDbPath: string

  /**
   * Create a new migration runner
   * @param connection Database connection to run migrations on
   * @param migrations Record mapping version strings to migration modules
   * @param options Optional configuration
   */
  constructor(
    connection: DatabaseConnection,
    migrations: Record<string, MigrationModule>,
    options?: MigrationRunnerOptions
  ) {
    this.connection = connection
    this.migrations = new Map(Object.entries(migrations))
    this.migrationsDbPath = options?.migrationsDbPath ?? "./.migrations.db"
    this.migrationsDb = new MigrationsDatabaseManager(this.migrationsDbPath)
  }

  /**
   * Initialize migration tracking database
   *
   * Initializes the separate .migrations.db file for tracking applied migrations.
   */
  async initialize(): Promise<Result<void>> {
    return this.migrationsDb.initialize()
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<Result<number>> {
    try {
      const initResult = await this.initialize()
      if (initResult.isError) {
        return initResult
      }

      const sortedVersions = Array.from(this.migrations.keys()).sort()
      const statusResult = await this.migrationsDb.getApplied()

      if (statusResult.isError) {
        return statusResult
      }

      const appliedVersions = statusResult.value
      let migratedCount = 0

      for (const version of sortedVersions) {
        if (!appliedVersions.includes(version)) {
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
  async status(): Promise<
    Result<{
      applied: string[]
      pending: string[]
    }>
  > {
    try {
      const initResult = await this.initialize()
      if (initResult.isError) {
        return initResult
      }

      const allVersions = Array.from(this.migrations.keys()).sort()
      return this.migrationsDb.getStatus(allVersions)
    } catch (error) {
      return {
        isError: true,
        error: `Failed to get status: ${error}`,
      }
    }
  }

  /**
   * Close the migrations database connection
   *
   * Should be called before application shutdown.
   */
  close(): void {
    this.migrationsDb.close()
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

      // Record migration in migrations database
      const recordResult = await this.migrationsDb.recordApplied(version, version)

      if (recordResult.isError) {
        return recordResult
      }

      return { isError: false, value: undefined }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to run migration ${version}: ${error}`,
      }
    }
  }
}
