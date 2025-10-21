/**
 * Query value object with named placeholder support
 * Ensures type-safe, validated database queries
 */

import type { Result } from "../types.ts"

/**
 * Query value object with named placeholders
 * Syntax: :paramName
 * Example: Query.create('SELECT * FROM users WHERE email = :email', { email: 'test@example.com' })
 */
export class Query {
  private sql: string
  private params: Record<string, unknown>
  private positionalParams: unknown[]
  private placeholders: string[]

  /**
   * Private constructor - use create() instead
   */
  private constructor(
    sql: string,
    params: Record<string, unknown>,
    placeholders: string[],
    positionalParams: unknown[]
  ) {
    this.sql = sql
    this.params = params
    this.placeholders = placeholders
    this.positionalParams = positionalParams
  }

  /**
   * Create a query with named placeholders
   * @param sql SQL query with :paramName placeholders
   * @param params Object with parameter values
   * @returns Result with Query instance or error
   */
  static create(
    sql: string,
    params?: Record<string, unknown>
  ): Result<Query> {
    try {
      // Extract all :name placeholders from SQL
      const placeholderPattern = /:([a-zA-Z_][a-zA-Z0-9_]*)/g
      const placeholders: string[] = []
      let match: RegExpExecArray | null = null

      do {
        match = placeholderPattern.exec(sql)
        if (match !== null) {
          placeholders.push(match[1])
        }
      } while (match !== null)

      // Check for duplicates
      const duplicates = placeholders.filter(
        (p, i) => placeholders.indexOf(p) !== i
      )
      if (duplicates.length > 0) {
        return {
          isError: true,
          error: `Duplicate placeholders: ${[...new Set(duplicates)].join(", ")}`,
        }
      }

      const providedParams = params ?? {}
      const uniquePlaceholders = [...new Set(placeholders)]

      // Validate all placeholders have values
      const missingParams = uniquePlaceholders.filter((p) => !(p in providedParams))
      if (missingParams.length > 0) {
        return {
          isError: true,
          error: `Missing parameters: ${missingParams.join(", ")}`,
        }
      }

      // Check for extra parameters
      const extraParams = Object.keys(providedParams).filter(
        (p) => !uniquePlaceholders.includes(p)
      )
      if (extraParams.length > 0) {
        return {
          isError: true,
          error: `Extra parameters: ${extraParams.join(", ")}`,
        }
      }

      // Convert named placeholders to positional (?)
      const positionalParams = uniquePlaceholders.map(
        (p) => providedParams[p]
      )

      return {
        isError: false,
        value: new Query(
          sql,
          providedParams,
          uniquePlaceholders,
          positionalParams
        ),
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
        value: new Query(sql, {}, [], []),
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to create simple query: ${error}`,
      }
    }
  }

  /**
   * Get the original SQL with named placeholders
   */
  getOriginalSql(): string {
    return this.sql
  }

  /**
   * Get the SQL converted to positional placeholders
   */
  getPositionalSql(): string {
    return this.getOriginalSql().replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "?")
  }

  /**
   * Get parameters as array (positional order)
   */
  getParams(): unknown[] {
    return [...this.positionalParams]
  }

  /**
   * Get parameters as object (named)
   */
  getNamedParams(): Record<string, unknown> {
    return { ...this.params }
  }

  /**
   * Get placeholder names in order
   */
  getPlaceholders(): string[] {
    return [...this.placeholders]
  }

  /**
   * Check if query has parameters
   */
  hasParams(): boolean {
    return this.placeholders.length > 0
  }

  /**
   * Get parameter count
   */
  getParamCount(): number {
    return this.placeholders.length
  }

  /**
   * Bind additional value to a placeholder
   * Returns new Query with updated binding
   * @param param Placeholder name
   * @param value Value to bind
   */
  bind(param: string, value: unknown): Result<Query> {
    if (!this.placeholders.includes(param)) {
      return {
        isError: true,
        error: `Parameter ${param} not found in query`,
      }
    }

    const newParams = { ...this.params, [param]: value }
    return Query.create(this.sql, newParams)
  }

  /**
   * Create a new query with different parameters
   * Useful for query reuse
   * @param newParams New parameter values
   */
  withParams(newParams: Record<string, unknown>): Result<Query> {
    return Query.create(this.sql, newParams)
  }

  /**
   * Get debug information
   */
  debug(): object {
    return {
      originalSql: this.sql,
      positionalSql: this.getPositionalSql(),
      namedParams: this.params,
      positionalParams: this.positionalParams,
      placeholders: this.placeholders,
    }
  }

  /**
   * Validate query structure
   * Checks that SQL is properly formed
   */
  validate(): Result<void> {
    // Check for unclosed string literals
    const singleQuotes = (this.sql.match(/'/g) || []).length
    const doubleQuotes = (this.sql.match(/"/g) || []).length

    if (singleQuotes % 2 !== 0) {
      return {
        isError: true,
        error: "Unclosed single quote in SQL",
      }
    }

    if (doubleQuotes % 2 !== 0) {
      return {
        isError: true,
        error: "Unclosed double quote in SQL",
      }
    }

    // Check for common SQL syntax errors is deferred to database execution
    // which can handle most SQL variations correctly

    return { isError: false, value: undefined }
  }
}
