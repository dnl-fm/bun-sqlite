/**
 * Query value object with named placeholder support
 * Ensures type-safe, validated database queries
 */

import type { Result } from "../types.ts"

/**
 * Query value object with named placeholders
 * Supports `:paramName` syntax that directly maps to Bun's SQLite named parameters
 * Example: Query.create('SELECT * FROM users WHERE email = :email', { email: 'test@example.com' })
 */
export class Query {
  private sql: string
  private params: Record<string, unknown>

  /**
   * Private constructor - use create() instead
   */
  private constructor(sql: string, params: Record<string, unknown>) {
    this.sql = sql
    this.params = params
  }

  /**
   * Create a query with named placeholders
   * @param sql SQL query with :paramName placeholders
   * @param params Object with parameter values
   * @returns Result with Query instance or error
   */
  static create(sql: string, params?: Record<string, unknown>): Result<Query> {
    try {
      // Extract all :name placeholders from SQL
      const placeholderPattern = /:([a-zA-Z_][a-zA-Z0-9_]*)/g
      const placeholders: string[] = []
      let match: RegExpExecArray | null = null

      do {
        match = placeholderPattern.exec(sql)
        if (match?.[1]) {
          placeholders.push(match[1])
        }
      } while (match !== null)

      // Check for duplicates
      const duplicates = placeholders.filter((p, i) => placeholders.indexOf(p) !== i)
      if (duplicates.length > 0) {
        return {
          isError: true,
          error: `Duplicate placeholders: ${[...new Set(duplicates)].join(", ")}`,
        }
      }

      const providedParams = params ?? {}
      const uniquePlaceholders = [...new Set(placeholders)]

      // Validate all placeholders have values
      const missingParams = uniquePlaceholders.filter(p => !(p in providedParams))
      if (missingParams.length > 0) {
        return {
          isError: true,
          error: `Missing parameters: ${missingParams.join(", ")}`,
        }
      }

      // Check for extra parameters
      const extraParams = Object.keys(providedParams).filter(p => !uniquePlaceholders.includes(p))
      if (extraParams.length > 0) {
        return {
          isError: true,
          error: `Extra parameters: ${extraParams.join(", ")}`,
        }
      }

      return {
        isError: false,
        value: new Query(sql, providedParams),
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to create query: ${error}`,
      }
    }
  }

  /**
   * Create a query without parameters
   * Useful for simple queries like SELECT * FROM table
   * @param sql SQL query
   * @returns Result with Query instance or error
   */
  static simple(sql: string): Result<Query> {
    try {
      // Check for accidental placeholders
      if (/:/.test(sql)) {
        return {
          isError: true,
          error: "Simple query contains placeholders. Use Query.create() instead.",
        }
      }

      return {
        isError: false,
        value: new Query(sql, {}),
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to create simple query: ${error}`,
      }
    }
  }

  /**
   * Get the SQL with named placeholders (:paramName syntax)
   * @returns SQL string with :paramName placeholders for Bun SQLite
   */
  getSql(): string {
    return this.sql
  }

  /**
   * Get parameters as an object with named placeholders
   * Use with Bun's SQLite API: stmt.get(query.getParams())
   * @returns Object with parameter names and values
   */
  getParams(): Record<string, unknown> {
    return { ...this.params }
  }
}
