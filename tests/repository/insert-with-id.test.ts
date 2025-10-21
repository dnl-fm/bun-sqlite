/**
 * BaseRepository ID validation tests
 * Verifies insertWithId() method enforces required ID field
 */

import { describe, it, expect, beforeEach } from "bun:test"
import { BaseRepository } from "../../src/repository/base-repository.ts"
import { Query } from "../../src/query/query.ts"
import { createDatabaseConnection } from "../../src/core/connection.ts"
import type { DatabaseConnection } from "../../src/types.ts"

interface TestEntity {
  id: string
  name: string
}

class TestRepository extends BaseRepository<TestEntity, string> {
  mapRow(row: unknown): TestEntity {
    const obj = row as Record<string, unknown>
    return {
      id: String(obj.id),
      name: String(obj.name),
    }
  }
}

describe("BaseRepository - insertWithId", () => {
  let connection: DatabaseConnection
  let repo: TestRepository

  beforeEach(() => {
    const bunDb = new (require("bun:sqlite").Database)(":memory:")
    connection = createDatabaseConnection(bunDb)

    // Create test table
    connection.exec(`
      CREATE TABLE IF NOT EXISTS test_entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      )
    `)

    repo = new TestRepository(connection, "test_entities")
  })

  it("should insert with valid ID", () => {
    const query = Query.create(
      "INSERT INTO test_entities (id, name) VALUES (:id, :name)",
      {
        id: "entity_123",
        name: "Test Entity",
      }
    )

    expect(query.isError).toBe(false)
    if (!query.isError) {
      const result = repo.insertWithId(query.value)
      expect(result.isError).toBe(false)
      expect(result.value).toBe(1) // One row inserted
    }
  })

  it("should reject insert without ID parameter", () => {
    const query = Query.create(
      "INSERT INTO test_entities (name) VALUES (:name)",
      { name: "No ID Entity" }
    )

    expect(query.isError).toBe(false)
    if (!query.isError) {
      const result = repo.insertWithId(query.value)
      expect(result.isError).toBe(true)
      expect(result.error).toContain("Missing required parameter: id")
    }
  })

  it("should reject insert with null ID", () => {
    const query = Query.create(
      "INSERT INTO test_entities (id, name) VALUES (:id, :name)",
      {
        id: null,
        name: "Null ID Entity",
      }
    )

    expect(query.isError).toBe(false)
    if (!query.isError) {
      const result = repo.insertWithId(query.value)
      expect(result.isError).toBe(true)
      expect(result.error).toContain("ID field cannot be null")
    }
  })

  it("should reject insert with undefined ID", () => {
    const query = Query.create(
      "INSERT INTO test_entities (id, name) VALUES (:id, :name)",
      {
        id: undefined,
        name: "Undefined ID Entity",
      }
    )

    expect(query.isError).toBe(false)
    if (!query.isError) {
      const result = repo.insertWithId(query.value)
      expect(result.isError).toBe(true)
      expect(result.error).toContain("ID field cannot be null")
    }
  })

  it("should reject insert with empty string ID", () => {
    const query = Query.create(
      "INSERT INTO test_entities (id, name) VALUES (:id, :name)",
      {
        id: "",
        name: "Empty ID Entity",
      }
    )

    expect(query.isError).toBe(false)
    if (!query.isError) {
      const result = repo.insertWithId(query.value)
      expect(result.isError).toBe(true)
      expect(result.error).toContain("ID field cannot be null, undefined, or empty")
    }
  })

  it("should work with numeric string ID", () => {
    const query = Query.create(
      "INSERT INTO test_entities (id, name) VALUES (:id, :name)",
      {
        id: "123",
        name: "Numeric ID",
      }
    )

    expect(query.isError).toBe(false)
    if (!query.isError) {
      const result = repo.insertWithId(query.value)
      expect(result.isError).toBe(false)
      expect(result.value).toBe(1)
    }
  })

  it("should work with prefixed ID", () => {
    const query = Query.create(
      "INSERT INTO test_entities (id, name) VALUES (:id, :name)",
      {
        id: "entity_01ARZ3NDEKTSV4RRFFQ69G5FAV",
        name: "Prefixed ID",
      }
    )

    expect(query.isError).toBe(false)
    if (!query.isError) {
      const result = repo.insertWithId(query.value)
      expect(result.isError).toBe(false)
      expect(result.value).toBe(1)
    }
  })

  it("should preserve backward compatibility with insert()", () => {
    const query = Query.create(
      "INSERT INTO test_entities (id, name) VALUES (:id, :name)",
      {
        id: "entity_456",
        name: "Backward Compat",
      }
    )

    expect(query.isError).toBe(false)
    if (!query.isError) {
      // Old insert() should still work without validation
      const result = repo.insert(query.value)
      expect(result.isError).toBe(false)
      expect(result.value).toBe(1)
    }
  })

  it("should validate ID on each insertWithId call", () => {
    // First insert should succeed
    const query1 = Query.create(
      "INSERT INTO test_entities (id, name) VALUES (:id, :name)",
      { id: "entity_1", name: "First" }
    )

    expect(query1.isError).toBe(false)
    if (!query1.isError) {
      const result1 = repo.insertWithId(query1.value)
      expect(result1.isError).toBe(false)
    }

    // Second insert without ID should fail
    const query2 = Query.create(
      "INSERT INTO test_entities (name) VALUES (:name)",
      { name: "Second" }
    )

    expect(query2.isError).toBe(false)
    if (!query2.isError) {
      const result2 = repo.insertWithId(query2.value)
      expect(result2.isError).toBe(true)
    }
  })

  it("should allow insert() without ID validation (backward compatibility)", () => {
    // Using insert() without ID should not be validated by insertWithId()
    // It will only fail at database level (NOT NULL constraint on id)
    const query = Query.create(
      "INSERT INTO test_entities (id, name) VALUES (:id, :name)",
      { id: "compat_check", name: "Compat Entity" }
    )

    expect(query.isError).toBe(false)
    if (!query.isError) {
      // insert() should work normally without ID validation
      const result = repo.insert(query.value)
      expect(result.isError).toBe(false)
      expect(result.value).toBe(1)
    }
  })
})
