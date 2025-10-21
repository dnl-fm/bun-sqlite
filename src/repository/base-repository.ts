/**
 * BaseRepository abstract class
 * Provides generic CRUD operations using Query value objects
 */

import { Query } from "../query/query.ts"
import type { DatabaseConnection, Result, EntityId } from "../types.ts"

/**
 * Abstract base repository for type-safe data access
 * Extend this class and implement mapRow() for your entity
 */
export abstract class BaseRepository<TEntity, TId extends EntityId> {
  protected connection: DatabaseConnection
  protected tableName: string

  /**
   * Constructor
   * @param connection Database connection
   * @param tableName Name of the table
   */
  constructor(connection: DatabaseConnection, tableName: string) {
    this.connection = connection
    this.tableName = tableName
  }

  /**
   * Map a database row to an entity
   * Must be implemented by subclasses
   * @abstract
   */
  abstract mapRow(row: unknown): TEntity

  /**
   * Find entity by ID
   * @param id Entity ID
   * @returns Result with entity or error
   */
  findById(id: TId): Result<TEntity | null> {
    try {
      const queryResult = Query.create(`SELECT * FROM ${this.tableName} WHERE id = :id`, { id })

      if (queryResult.isError) {
        return queryResult
      }

      const stmt = this.connection.prepare(queryResult.value.getPositionalSql())
      const row = stmt.get(...queryResult.value.getParams())

      if (!row) {
        return { isError: false, value: null }
      }

      return { isError: false, value: this.mapRow(row) }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to find by ID: ${error}`,
      }
    }
  }

  /**
   * Find all entities
   * @returns Result with array of entities or error
   */
  findAll(): Result<TEntity[]> {
    try {
      const queryResult = Query.simple(`SELECT * FROM ${this.tableName}`)

      if (queryResult.isError) {
        return queryResult
      }

      const stmt = this.connection.prepare(queryResult.value.getPositionalSql())
      const rows = stmt.all()

      return {
        isError: false,
        value: rows.map(row => this.mapRow(row)),
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to find all: ${error}`,
      }
    }
  }

  /**
   * Execute custom query with named placeholders
   * @param query Query value object
   * @returns Result with array of entities or error
   */
  findByQuery(query: Query): Result<TEntity[]> {
    try {
      const stmt = this.connection.prepare(query.getPositionalSql())
      const rows = stmt.all(...query.getParams())

      return {
        isError: false,
        value: rows.map(row => this.mapRow(row)),
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to find by query: ${error}`,
      }
    }
  }

  /**
   * Execute custom query and get first result
   * @param query Query value object
   * @returns Result with entity or error
   */
  findOneByQuery(query: Query): Result<TEntity | null> {
    try {
      const stmt = this.connection.prepare(query.getPositionalSql())
      const row = stmt.get(...query.getParams())

      if (!row) {
        return { isError: false, value: null }
      }

      return { isError: false, value: this.mapRow(row) }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to find one by query: ${error}`,
      }
    }
  }

  /**
   * Count entities
   * @returns Result with count or error
   */
  count(): Result<number> {
    try {
      const queryResult = Query.simple(`SELECT COUNT(*) as count FROM ${this.tableName}`)

      if (queryResult.isError) {
        return queryResult
      }

      const stmt = this.connection.prepare(queryResult.value.getPositionalSql())
      const result = stmt.get() as { count: number } | undefined

      return {
        isError: false,
        value: result?.count ?? 0,
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to count: ${error}`,
      }
    }
  }

  /**
   * Execute count query with WHERE clause
   * @param query Query value object (should be SELECT COUNT(*) query)
   * @returns Result with count or error
   */
  countByQuery(query: Query): Result<number> {
    try {
      const stmt = this.connection.prepare(query.getPositionalSql())
      const result = stmt.get(...query.getParams()) as { count: number } | undefined

      return {
        isError: false,
        value: result?.count ?? 0,
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to count by query: ${error}`,
      }
    }
  }

  /**
   * Check if entity exists by ID
   * @param id Entity ID
   * @returns Result with boolean or error
   */
  exists(id: TId): Result<boolean> {
    try {
      const queryResult = Query.create(`SELECT 1 FROM ${this.tableName} WHERE id = :id LIMIT 1`, {
        id,
      })

      if (queryResult.isError) {
        return queryResult
      }

      const stmt = this.connection.prepare(queryResult.value.getPositionalSql())
      const result = stmt.get(...queryResult.value.getParams())

      return {
        isError: false,
        value: result !== null && result !== undefined,
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to check existence: ${error}`,
      }
    }
  }

  /**
   * Execute raw SQL query
   * Bypasses entity mapping, returns raw rows
   * Use with caution - prefer Query for safety
   * @param query Query value object
   * @returns Result with raw rows or error
   */
  queryRaw(query: Query): Result<unknown[]> {
    try {
      const stmt = this.connection.prepare(query.getPositionalSql())
      const rows = stmt.all(...query.getParams())

      return {
        isError: false,
        value: rows,
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to query raw: ${error}`,
      }
    }
  }

  /**
   * Execute update query
   * @param query Query value object (UPDATE statement)
   * @returns Result with number of affected rows or error
   */
  update(query: Query): Result<number> {
    try {
      const stmt = this.connection.prepare(query.getPositionalSql())
      const result = stmt.run(...query.getParams())

      return {
        isError: false,
        value: result.changes,
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to update: ${error}`,
      }
    }
  }

  /**
   * Execute delete query
   * @param query Query value object (DELETE statement)
   * @returns Result with number of deleted rows or error
   */
  delete(query: Query): Result<number> {
    try {
      const stmt = this.connection.prepare(query.getPositionalSql())
      const result = stmt.run(...query.getParams())

      return {
        isError: false,
        value: result.changes,
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to delete: ${error}`,
      }
    }
  }

  /**
   * Delete by ID
   * @param id Entity ID
   * @returns Result with boolean success or error
   */
  deleteById(id: TId): Result<boolean> {
    try {
      const queryResult = Query.create(`DELETE FROM ${this.tableName} WHERE id = :id`, { id })

      if (queryResult.isError) {
        return queryResult
      }

      const stmt = this.connection.prepare(queryResult.value.getPositionalSql())
      const result = stmt.run(...queryResult.value.getParams())

      return {
        isError: false,
        value: result.changes > 0,
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to delete by ID: ${error}`,
      }
    }
  }

  /**
   * Execute insert query
   * @param query Query value object (INSERT statement)
   * @returns Result with number of inserted rows or error
   */
  insert(query: Query): Result<number> {
    try {
      const stmt = this.connection.prepare(query.getPositionalSql())
      const result = stmt.run(...query.getParams())

      return {
        isError: false,
        value: result.changes,
      }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to insert: ${error}`,
      }
    }
  }

  /**
   * Begin transaction
   * Use with caution - ensure you commit or rollback
   */
  protected beginTransaction(): void {
    this.connection.exec("BEGIN TRANSACTION")
  }

  /**
   * Commit transaction
   */
  protected commit(): void {
    this.connection.exec("COMMIT")
  }

  /**
   * Rollback transaction
   */
  protected rollback(): void {
    this.connection.exec("ROLLBACK")
  }

  /**
   * Get the underlying database connection
   * Use only when necessary
   */
  getConnection(): DatabaseConnection {
    return this.connection
  }
}
