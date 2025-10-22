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
   * Rollback the last applied migration
   *
   * @returns Result with number of rollbacks (0 or 1) or error
   */
  async rollbackLast(): Promise<Result<number>> {
    try {
      const initResult = await this.initialize()
      if (initResult.isError) {
        return initResult
      }

      const appliedResult = await this.migrationsDb.getApplied()
      if (appliedResult.isError) {
        return appliedResult
      }

      const appliedVersions = appliedResult.value
      if (appliedVersions.length === 0) {
        return { isError: false, value: 0 }
      }

      // Get the last applied migration (reverse order)
      // Safe to access since we've checked length > 0
      const lastIndex = appliedVersions.length - 1
      const lastVersion = appliedVersions[lastIndex] as string
      const result = await this.rollbackMigration(lastVersion)

      if (result.isError) {
        return result
      }

      return { isError: false, value: 1 }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to rollback last migration: ${error}`,
      }
    }
  }

  /**
   * Rollback a specific migration by version
   *
   * @param version Migration version to rollback
   * @returns Result indicating success or error
   */
  async rollback(version: string): Promise<Result<number>> {
    try {
      const initResult = await this.initialize()
      if (initResult.isError) {
        return initResult
      }

      const appliedResult = await this.migrationsDb.getApplied()
      if (appliedResult.isError) {
        return appliedResult
      }

      const appliedVersions = appliedResult.value
      if (!appliedVersions.includes(version)) {
        return {
          isError: true,
          error: `Migration not applied: ${version}`,
        }
      }

      const result = await this.rollbackMigration(version)
      if (result.isError) {
        return result
      }

      return { isError: false, value: 1 }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to rollback migration ${version}: ${error}`,
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

  /**
   * Rollback a single migration
   * @private
   */
  private async rollbackMigration(version: string): Promise<Result<void>> {
    try {
      const migration = this.migrations.get(version)

      if (!migration) {
        return {
          isError: true,
          error: `Migration not found: ${version}`,
        }
      }

      // Check if migration has down function
      if (!migration.down) {
        return {
          isError: true,
          error: `Migration has no rollback: ${version}. Add a down() function to the migration file.`,
        }
      }

      // Execute down migration
      await migration.down(this.connection)

      // Remove migration from migrations database
      const removeResult = await this.migrationsDb.removeApplied(version)

      if (removeResult.isError) {
        return removeResult
      }

      return { isError: false, value: undefined }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to rollback migration ${version}: ${error}`,
      }
    }
  }
}
