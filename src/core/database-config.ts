/**
 * SQLite pragma configuration
 * Manages performance and behavior tuning
 */

import type { SQLitePragma, DatabaseConnection } from "../types.ts"

/**
 * Production-ready default pragmas for SQLite
 * Optimized for concurrency and performance
 */
export const DEFAULT_PRAGMAS: SQLitePragma[] = [
  { key: "journal_mode", value: "WAL" }, // Write-Ahead Logging
  { key: "busy_timeout", value: 10000 }, // 10s timeout for locked database
  { key: "synchronous", value: "NORMAL" }, // Balance safety and performance
  { key: "cache_size", value: 2000 }, // Memory cache pages
  { key: "temp_store", value: "MEMORY" }, // Temporary tables in RAM
  { key: "foreign_keys", value: "on" }, // Foreign key constraints
  { key: "threads", value: 2 }, // Multi-threaded mode
]

/**
 * Database configuration manager
 * Handles pragma application and validation
 */
export class DatabaseConfig {
  private pragmas: SQLitePragma[]

  /**
   * Create a new DatabaseConfig
   * @param pragmas Optional array of pragmas, defaults to DEFAULT_PRAGMAS
   */
  constructor(pragmas?: SQLitePragma[]) {
    this.pragmas = pragmas ?? [...DEFAULT_PRAGMAS]
  }

  /**
   * Apply all configured pragmas to a database connection
   * Must be called after opening connection but before first query
   * @param db Database connection to configure
   */
  apply(db: DatabaseConnection): void {
    for (const pragma of this.pragmas) {
      const sql = `PRAGMA ${pragma.key} = ${this.formatValue(pragma.value)}`
      try {
        db.exec(sql)
      } catch {
        // Silently ignore pragma errors - some pragmas may not be available in all SQLite versions
      }
    }
  }

  /**
   * Get the configured pragmas
   * @returns Array of pragmas
   */
  getPragmas(): SQLitePragma[] {
    return [...this.pragmas]
  }

  /**
   * Add or override a pragma
   * @param key Pragma key name
   * @param value Pragma value
   */
  setPragma(key: string, value: string | number | boolean): void {
    const index = this.pragmas.findIndex(p => p.key === key)
    if (index >= 0) {
      this.pragmas[index] = { key, value }
    } else {
      this.pragmas.push({ key, value })
    }
  }

  /**
   * Format pragma value for SQL
   * @private
   */
  private formatValue(value: string | number | boolean): string {
    if (typeof value === "string") {
      return `'${value}'`
    }
    if (typeof value === "boolean") {
      return value ? "ON" : "OFF"
    }
    return String(value)
  }

  /**
   * Create a config with minimal pragmas (for testing)
   * @returns DatabaseConfig with minimal pragmas
   */
  static minimal(): DatabaseConfig {
    return new DatabaseConfig([
      { key: "journal_mode", value: "MEMORY" }, // In-memory journal for speed
      { key: "synchronous", value: "OFF" }, // No disk sync
      { key: "foreign_keys", value: "off" }, // Disable FK for tests
    ])
  }

  /**
   * Create a config optimized for development
   * @returns DatabaseConfig optimized for development
   */
  static development(): DatabaseConfig {
    return new DatabaseConfig([
      { key: "journal_mode", value: "WAL" },
      { key: "busy_timeout", value: 5000 },
      { key: "synchronous", value: "NORMAL" },
      { key: "cache_size", value: 1000 },
      { key: "temp_store", value: "MEMORY" },
      { key: "foreign_keys", value: "on" },
    ])
  }

  /**
   * Create a config optimized for production
   * @returns DatabaseConfig optimized for production
   */
  static production(): DatabaseConfig {
    return new DatabaseConfig([
      { key: "journal_mode", value: "WAL" },
      { key: "busy_timeout", value: 10000 },
      { key: "synchronous", value: "NORMAL" },
      { key: "cache_size", value: 5000 },
      { key: "temp_store", value: "MEMORY" },
      { key: "foreign_keys", value: "on" },
      { key: "threads", value: 4 },
    ])
  }
}
