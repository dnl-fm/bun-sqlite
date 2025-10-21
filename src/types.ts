/**
 * Core types and interfaces for @dnl-fm/bun-sqlite
 */

/**
 * Result type for error handling - never throws
 */
export type Result<T> =
  | { isError: false; value: T }
  | { isError: true; error: string }

/**
 * SQLite pragma configuration
 */
export interface SQLitePragma {
  key: string
  value: string | number | boolean
}

/**
 * Query result with optional metadata
 */
export interface QueryResult<T = unknown> {
  rows: T[]
  changes: number
  lastInsertId?: number
}

/**
 * Type-safe database connection interface
 */
export interface DatabaseConnection {
  prepare(sql: string): PreparedStatement
  exec(sql: string): void
  close(): void
}

/**
 * Prepared statement for executing queries
 */
export interface PreparedStatement {
  run(...params: unknown[]): RunResult
  get(...params: unknown[]): unknown | undefined
  all(...params: unknown[]): unknown[]
}

/**
 * Result from running an INSERT/UPDATE/DELETE
 */
export interface RunResult {
  changes: number
  lastInsertRowid?: number | bigint
}

/**
 * Migration file interface
 */
export interface Migration {
  up(db: DatabaseConnection): void | Promise<void>
  down(db: DatabaseConnection): void | Promise<void>
}

/**
 * Applied migration record
 */
export interface AppliedMigration {
  version: string
  name: string
  appliedAt: number
  checksum: string
}

/**
 * Migration runner options
 */
export interface MigrationRunnerOptions {
  migrationsDir: string
  checksum?: boolean
}

/**
 * Generic entity ID type
 */
export type EntityId = string | number

/**
 * Row mapper function for repositories
 */
export type RowMapper<TEntity> = (row: unknown) => TEntity
