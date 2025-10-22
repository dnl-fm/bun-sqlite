/**
 * Core Database class
 * Singleton pattern for SQLite connections
 * Handles schema initialization and connection lifecycle
 */

import { Database as BunDatabase } from "bun:sqlite"
import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import type { DatabaseConnection, Result } from "../types.ts"
import { DatabaseConfig, DEFAULT_PRAGMAS } from "./database-config.ts"
import { createDatabaseConnection } from "./connection.ts"

/**
 * Database class with singleton pattern
 * Manages SQLite connection lifecycle
 */
export class Database {
  private static instance: Database | null = null
  private connection: DatabaseConnection | null = null
  private config: DatabaseConfig
  private path: string

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor(path: string, config?: DatabaseConfig) {
    this.path = path
    this.config = config ?? new DatabaseConfig(DEFAULT_PRAGMAS)
  }

  /**
   * Get or create database instance (singleton)
   * @param path Database file path (":memory:" for in-memory)
   * @param config Optional DatabaseConfig
   * @returns Result with Database instance or error
   */
  static async getInstance(
    path: string = ":memory:",
    config?: DatabaseConfig
  ): Promise<Result<Database>> {
    try {
      if (Database.instance === null) {
        const db = new Database(path, config)
        const result = await db.initialize()
        if (result.isError) {
          return result
        }
        Database.instance = db
      }
      return { isError: false, value: Database.instance }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to get database instance: ${error}`,
      }
    }
  }

  /**
   * Get current instance without initializing
   * @returns Database instance or null
   */
  static getCurrentInstance(): Database | null {
    return Database.instance
  }

  /**
   * Reset singleton (mainly for testing)
   */
  static reset(): void {
    if (Database.instance?.connection) {
      try {
        Database.instance.connection.close()
      } catch (_) {
        // Ignore close errors
      }
    }
    Database.instance = null
  }

  /**
   * Initialize database connection and apply pragmas
   * @param schemaPath Optional path to schema.sql file
   * @private
   */
  private async initialize(schemaPath?: string): Promise<Result<void>> {
    try {
      // Create directory if file-based
      if (this.path !== ":memory:") {
        const dir = dirname(this.path)
        if (!existsSync(dir)) {
          await mkdir(dir, { recursive: true })
        }
      }

      // Open connection with strict: true to use parameter names without prefixes
      // When strict: true, you can bind parameters like {email: "test"} instead of {":email": "test"}
      const bunDb = new BunDatabase(this.path, { strict: true })
      this.connection = createDatabaseConnection(bunDb)

      // Apply pragmas
      this.config.apply(this.connection)

      // Load schema if provided
      if (schemaPath) {
        const result = await this.loadSchema(schemaPath)
        if (result.isError) {
          return result
        }
      }

      return { isError: false, value: undefined }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to initialize database: ${error}`,
      }
    }
  }

  /**
   * Load schema from SQL file
   * @param schemaPath Path to schema.sql file
   * @private
   */
  private async loadSchema(schemaPath: string): Promise<Result<void>> {
    try {
      if (!this.connection) {
        return { isError: true, error: "Connection not initialized" }
      }

      const schema = await Bun.file(schemaPath).text()
      this.connection.exec(schema)
      return { isError: false, value: undefined }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to load schema from ${schemaPath}: ${error}`,
      }
    }
  }

  /**
   * Get the database connection
   * @returns DatabaseConnection instance
   * @throws Error if connection not initialized
   */
  getConnection(): DatabaseConnection {
    if (!this.connection) {
      throw new Error("Database connection not initialized")
    }
    return this.connection
  }

  /**
   * Execute a prepared statement
   * @param sql SQL query
   * @param params Query parameters
   * @returns Query results
   */
  query(sql: string, params?: unknown[]): unknown[] {
    const stmt = this.getConnection().prepare(sql)
    return stmt.all(...(params || []))
  }

  /**
   * Execute a query and get first result
   * @param sql SQL query
   * @param params Query parameters
   * @returns First row or undefined
   */
  queryOne(sql: string, params?: unknown[]): unknown {
    const stmt = this.getConnection().prepare(sql)
    return stmt.get(...(params || []))
  }

  /**
   * Execute an insert/update/delete statement
   * @param sql SQL query
   * @param params Query parameters
   * @returns Number of changes
   */
  run(sql: string, params?: unknown[]): number {
    const stmt = this.getConnection().prepare(sql)
    const result = stmt.run(...(params || []))
    return result.changes
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.connection) {
      try {
        this.connection.close()
        this.connection = null
        Database.instance = null
      } catch {
        // Silently ignore errors when closing connection
      }
    }
  }

  /**
   * Get database file path
   * @returns Path (":memory:" if in-memory)
   */
  getPath(): string {
    return this.path
  }

  /**
   * Get database configuration
   * @returns DatabaseConfig instance
   */
  getConfig(): DatabaseConfig {
    return this.config
  }

  /**
   * Check if database is connected
   * @returns true if connection is active
   */
  isConnected(): boolean {
    return this.connection !== null
  }
}
