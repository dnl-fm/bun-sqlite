/**
 * DatabaseConnection interface abstraction
 * Allows swapping between different SQLite implementations
 */

import type { DatabaseConnection } from "../types.ts"

/**
 * Bun's native sqlite implementation
 * Re-export for convenience and type safety
 */
export type BunSQLiteConnection = {
  prepare(sql: string): BunPreparedStatement
  exec(sql: string): void
  close(): void
}

/**
 * Prepared statement interface for Bun's SQLite implementation
 * Provides methods to execute queries with parameters
 */
export type BunPreparedStatement = {
  run(...params: unknown[]): BunRunResult
  get(...params: unknown[]): unknown | undefined
  all(...params: unknown[]): unknown[]
}

/**
 * Result from executing an INSERT/UPDATE/DELETE statement
 * Contains change count and optionally the last inserted row ID
 */
export type BunRunResult = {
  changes: number
  lastInsertRowid?: number | bigint
}

/**
 * Adapter to convert Bun's sqlite to DatabaseConnection interface
 * @param bunDb Bun's native SQLite database connection
 * @returns DatabaseConnection instance compatible with the library
 */
export function createDatabaseConnection(
  bunDb: BunSQLiteConnection
): DatabaseConnection {
  return {
    prepare(sql: string) {
      const stmt = bunDb.prepare(sql)
      return {
        run(...params: unknown[]) {
          const result = stmt.run(...params)
          return {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid,
          } satisfies Record<string, unknown>
        },
        get(...params: unknown[]) {
          return stmt.get(...params)
        },
        all(...params: unknown[]) {
          return stmt.all(...params)
        },
      }
    },
    exec(sql: string) {
      bunDb.exec(sql)
    },
    close() {
      bunDb.close()
    },
  }
}
