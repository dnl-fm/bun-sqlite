/**
 * Comprehensive tests for BaseRepository
 * Tests all CRUD operations, transactions, and error handling
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import type { Database } from "../../src/core/database.ts"
import { BaseRepository } from "../../src/repository/base-repository.ts"
import { Query } from "../../src/query/query.ts"
import type { DatabaseConnection } from "../../src/types.ts"
import {
  createTestDatabase,
  initializeTestSchema,
  cleanupTestDatabase,
  USER_TEST_SCHEMA,
  assertSuccess,
} from "../test-utils.ts"

/**
 * User entity for testing
 */
interface User {
  id: string
  email: string
  name: string
  status: string
  createdAt: number
}

/**
 * Concrete TestRepository implementation for testing BaseRepository
 */
class TestRepository extends BaseRepository<User, string> {
  constructor(connection: DatabaseConnection) {
    super(connection, "users")
  }

  /**
   * Map database row to User entity
   */
  mapRow(row: unknown): User {
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      email: r.email as string,
      name: r.name as string,
      status: r.status as string,
      createdAt: r.created_at as number,
    }
  }

  /**
   * Helper method to insert a user (exposed for testing)
   */
  insertUser(user: User): void {
    const stmt = this.connection.prepare(
      `INSERT INTO users (id, email, name, status, created_at) VALUES (?, ?, ?, ?, ?)`
    )
    stmt.run(user.id, user.email, user.name, user.status, user.createdAt)
  }

  /**
   * Expose transaction methods for testing
   */
  public testBeginTransaction(): void {
    this.beginTransaction()
  }

  public testCommit(): void {
    this.commit()
  }

  public testRollback(): void {
    this.rollback()
  }
}

/**
 * Helper to create test user
 */
function createUser(overrides?: Partial<User>): User {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    status: "active",
    createdAt: Date.now(),
    ...overrides,
  }
}

describe("BaseRepository", () => {
  let db: Database
  let repository: TestRepository

  beforeEach(async () => {
    db = await createTestDatabase()
    initializeTestSchema(db, USER_TEST_SCHEMA)
    repository = new TestRepository(db.getConnection())
  })

  afterEach(() => {
    cleanupTestDatabase(db)
  })

  describe("findById", () => {
    it("should find entity by ID when exists", () => {
      // Arrange
      const user = createUser({ id: "user-123" })
      repository.insertUser(user)

      // Act
      const result = repository.findById("user-123")

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).not.toBeNull()
        expect(result.value?.id).toBe("user-123")
        expect(result.value?.email).toBe(user.email)
        expect(result.value?.name).toBe(user.name)
        expect(result.value?.status).toBe(user.status)
      }
    })

    it("should return null when entity not found", () => {
      // Act
      const result = repository.findById("non-existent")

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBeNull()
      }
    })

    it("should handle database errors gracefully", () => {
      // Arrange - close connection to force error
      db.close()

      // Act
      const result = repository.findById("user-123")

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Failed to find by ID")
      }
    })
  })

  describe("findAll", () => {
    it("should return empty array when no entities exist", () => {
      // Act
      const result = repository.findAll()

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toEqual([])
      }
    })

    it("should return all entities", () => {
      // Arrange
      const user1 = createUser({ id: "user-1", email: "user1@example.com" })
      const user2 = createUser({ id: "user-2", email: "user2@example.com" })
      const user3 = createUser({ id: "user-3", email: "user3@example.com" })

      repository.insertUser(user1)
      repository.insertUser(user2)
      repository.insertUser(user3)

      // Act
      const result = repository.findAll()

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.length).toBe(3)
        expect(result.value[0]?.id).toBe("user-1")
        expect(result.value[1]?.id).toBe("user-2")
        expect(result.value[2]?.id).toBe("user-3")
      }
    })

    it("should handle database errors gracefully", () => {
      // Arrange - close connection to force error
      db.close()

      // Act
      const result = repository.findAll()

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Failed to find all")
      }
    })
  })

  describe("findByQuery", () => {
    it("should find entities matching query", () => {
      // Arrange
      const user1 = createUser({
        id: "user-1",
        email: "active1@example.com",
        status: "active",
      })
      const user2 = createUser({
        id: "user-2",
        email: "active2@example.com",
        status: "active",
      })
      const user3 = createUser({
        id: "user-3",
        email: "inactive@example.com",
        status: "inactive",
      })

      repository.insertUser(user1)
      repository.insertUser(user2)
      repository.insertUser(user3)

      const queryResult = Query.create(
        "SELECT * FROM users WHERE status = :status",
        { status: "active" }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.findByQuery(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.length).toBe(2)
        expect(result.value[0]?.status).toBe("active")
        expect(result.value[1]?.status).toBe("active")
      }
    })

    it("should return empty array when no matches", () => {
      // Arrange
      const user = createUser({ status: "active" })
      repository.insertUser(user)

      const queryResult = Query.create(
        "SELECT * FROM users WHERE status = :status",
        { status: "inactive" }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.findByQuery(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toEqual([])
      }
    })

    it("should handle complex queries with multiple parameters", () => {
      // Arrange
      const user1 = createUser({
        id: "user-1",
        email: "alice@example.com",
        name: "Alice",
        status: "active",
      })
      const user2 = createUser({
        id: "user-2",
        email: "bob@example.com",
        name: "Bob",
        status: "active",
      })
      const user3 = createUser({
        id: "user-3",
        email: "charlie@example.com",
        name: "Charlie",
        status: "inactive",
      })

      repository.insertUser(user1)
      repository.insertUser(user2)
      repository.insertUser(user3)

      const queryResult = Query.create(
        "SELECT * FROM users WHERE status = :status AND name LIKE :namePattern",
        { status: "active", namePattern: "A%" }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.findByQuery(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.length).toBe(1)
        expect(result.value[0]?.name).toBe("Alice")
      }
    })

    it("should handle database errors gracefully", () => {
      // Arrange - create invalid query
      const queryResult = Query.simple("SELECT * FROM non_existent_table")
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.findByQuery(query)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Failed to find by query")
      }
    })
  })

  describe("findOneByQuery", () => {
    it("should find first entity matching query", () => {
      // Arrange
      const user1 = createUser({ id: "user-1", email: "user1@example.com" })
      const user2 = createUser({ id: "user-2", email: "user2@example.com" })

      repository.insertUser(user1)
      repository.insertUser(user2)

      const queryResult = Query.create(
        "SELECT * FROM users WHERE email = :email",
        { email: "user2@example.com" }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.findOneByQuery(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).not.toBeNull()
        expect(result.value?.id).toBe("user-2")
        expect(result.value?.email).toBe("user2@example.com")
      }
    })

    it("should return null when no match found", () => {
      // Arrange
      const queryResult = Query.create(
        "SELECT * FROM users WHERE email = :email",
        { email: "nonexistent@example.com" }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.findOneByQuery(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBeNull()
      }
    })

    it("should return first result when multiple matches exist", () => {
      // Arrange
      const user1 = createUser({
        id: "user-1",
        email: "active1@example.com",
        status: "active",
      })
      const user2 = createUser({
        id: "user-2",
        email: "active2@example.com",
        status: "active",
      })

      repository.insertUser(user1)
      repository.insertUser(user2)

      const queryResult = Query.create(
        "SELECT * FROM users WHERE status = :status ORDER BY id ASC",
        { status: "active" }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.findOneByQuery(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).not.toBeNull()
        expect(result.value?.id).toBe("user-1")
      }
    })

    it("should handle database errors gracefully", () => {
      // Arrange - create invalid query
      const queryResult = Query.simple("SELECT * FROM non_existent_table")
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.findOneByQuery(query)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Failed to find one by query")
      }
    })
  })

  describe("count", () => {
    it("should return 0 when table is empty", () => {
      // Act
      const result = repository.count()

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBe(0)
      }
    })

    it("should return correct count of entities", () => {
      // Arrange
      const user1 = createUser({ id: "user-1", email: "user1@example.com" })
      const user2 = createUser({ id: "user-2", email: "user2@example.com" })
      const user3 = createUser({ id: "user-3", email: "user3@example.com" })

      repository.insertUser(user1)
      repository.insertUser(user2)
      repository.insertUser(user3)

      // Act
      const result = repository.count()

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBe(3)
      }
    })

    it("should handle database errors gracefully", () => {
      // Arrange - close connection to force error
      db.close()

      // Act
      const result = repository.count()

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Failed to count")
      }
    })
  })

  describe("countByQuery", () => {
    it("should count entities matching query", () => {
      // Arrange
      const user1 = createUser({
        id: "user-1",
        email: "active1@example.com",
        status: "active",
      })
      const user2 = createUser({
        id: "user-2",
        email: "active2@example.com",
        status: "active",
      })
      const user3 = createUser({
        id: "user-3",
        email: "inactive@example.com",
        status: "inactive",
      })

      repository.insertUser(user1)
      repository.insertUser(user2)
      repository.insertUser(user3)

      const queryResult = Query.create(
        "SELECT COUNT(*) as count FROM users WHERE status = :status",
        { status: "active" }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.countByQuery(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBe(2)
      }
    })

    it("should return 0 when no matches", () => {
      // Arrange
      const user = createUser({ status: "active" })
      repository.insertUser(user)

      const queryResult = Query.create(
        "SELECT COUNT(*) as count FROM users WHERE status = :status",
        { status: "inactive" }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.countByQuery(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBe(0)
      }
    })

    it("should handle complex count queries", () => {
      // Arrange
      const user1 = createUser({
        id: "user-1",
        email: "alice@example.com",
        name: "Alice",
        status: "active",
      })
      const user2 = createUser({
        id: "user-2",
        email: "anna@example.com",
        name: "Anna",
        status: "active",
      })
      const user3 = createUser({
        id: "user-3",
        email: "bob@example.com",
        name: "Bob",
        status: "active",
      })

      repository.insertUser(user1)
      repository.insertUser(user2)
      repository.insertUser(user3)

      const queryResult = Query.create(
        "SELECT COUNT(*) as count FROM users WHERE status = :status AND name LIKE :pattern",
        { status: "active", pattern: "A%" }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.countByQuery(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBe(2)
      }
    })

    it("should handle database errors gracefully", () => {
      // Arrange - create invalid query
      const queryResult = Query.simple(
        "SELECT COUNT(*) as count FROM non_existent_table"
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.countByQuery(query)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Failed to count by query")
      }
    })
  })

  describe("exists", () => {
    it("should return true when entity exists", () => {
      // Arrange
      const user = createUser({ id: "user-123" })
      repository.insertUser(user)

      // Act
      const result = repository.exists("user-123")

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBe(true)
      }
    })

    it("should return false when entity does not exist", () => {
      // Act
      const result = repository.exists("non-existent")

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBe(false)
      }
    })

    it("should handle database errors gracefully", () => {
      // Arrange - close connection to force error
      db.close()

      // Act
      const result = repository.exists("user-123")

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Failed to check existence")
      }
    })
  })

  describe("insert", () => {
    it("should insert new entity", () => {
      // Arrange
      const user = createUser({
        id: "user-new",
        email: "new@example.com",
      })

      const queryResult = Query.create(
        "INSERT INTO users (id, email, name, status, created_at) VALUES (:id, :email, :name, :status, :createdAt)",
        {
          id: user.id,
          email: user.email,
          name: user.name,
          status: user.status,
          createdAt: user.createdAt,
        }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.insert(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBe(1)

        // Verify entity was inserted
        const findResult = repository.findById("user-new")
        expect(findResult.isError).toBe(false)
        if (!findResult.isError) {
          expect(findResult.value?.email).toBe("new@example.com")
        }
      }
    })

    it("should handle database errors (duplicate key)", () => {
      // Arrange
      const user = createUser({ id: "user-1", email: "test@example.com" })
      repository.insertUser(user)

      const queryResult = Query.create(
        "INSERT INTO users (id, email, name, status, created_at) VALUES (:id, :email, :name, :status, :createdAt)",
        {
          id: user.id,
          email: user.email,
          name: user.name,
          status: user.status,
          createdAt: user.createdAt,
        }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.insert(query)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Failed to insert")
      }
    })

    it("should insert multiple entities", () => {
      // Arrange
      const user1 = createUser({ id: "user-1", email: "user1@example.com" })
      const user2 = createUser({ id: "user-2", email: "user2@example.com" })

      const query1Result = Query.create(
        "INSERT INTO users (id, email, name, status, created_at) VALUES (:id, :email, :name, :status, :createdAt)",
        {
          id: user1.id,
          email: user1.email,
          name: user1.name,
          status: user1.status,
          createdAt: user1.createdAt,
        }
      )
      const query1 = assertSuccess(query1Result)

      const query2Result = Query.create(
        "INSERT INTO users (id, email, name, status, created_at) VALUES (:id, :email, :name, :status, :createdAt)",
        {
          id: user2.id,
          email: user2.email,
          name: user2.name,
          status: user2.status,
          createdAt: user2.createdAt,
        }
      )
      const query2 = assertSuccess(query2Result)

      // Act
      const result1 = repository.insert(query1)
      const result2 = repository.insert(query2)

      // Assert
      expect(result1.isError).toBe(false)
      expect(result2.isError).toBe(false)

      const countResult = repository.count()
      expect(countResult.isError).toBe(false)
      if (!countResult.isError) {
        expect(countResult.value).toBe(2)
      }
    })
  })

  describe("update", () => {
    it("should update existing entity", () => {
      // Arrange
      const user = createUser({ id: "user-1", name: "Old Name" })
      repository.insertUser(user)

      const queryResult = Query.create(
        "UPDATE users SET name = :name WHERE id = :id",
        { id: "user-1", name: "New Name" }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.update(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBe(1)

        // Verify entity was updated
        const findResult = repository.findById("user-1")
        expect(findResult.isError).toBe(false)
        if (!findResult.isError) {
          expect(findResult.value?.name).toBe("New Name")
        }
      }
    })

    it("should return 0 when no rows affected", () => {
      // Arrange
      const queryResult = Query.create(
        "UPDATE users SET name = :name WHERE id = :id",
        { id: "non-existent", name: "New Name" }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.update(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBe(0)
      }
    })

    it("should update multiple entities", () => {
      // Arrange
      const user1 = createUser({
        id: "user-1",
        email: "user1@example.com",
        status: "active",
      })
      const user2 = createUser({
        id: "user-2",
        email: "user2@example.com",
        status: "active",
      })

      repository.insertUser(user1)
      repository.insertUser(user2)

      const queryResult = Query.create(
        "UPDATE users SET status = :status WHERE status = :oldStatus",
        { status: "inactive", oldStatus: "active" }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.update(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBe(2)

        // Verify entities were updated
        const findResult = repository.findAll()
        expect(findResult.isError).toBe(false)
        if (!findResult.isError) {
          expect(findResult.value.every((u) => u.status === "inactive")).toBe(
            true
          )
        }
      }
    })

    it("should handle database errors gracefully", () => {
      // Arrange - create invalid query
      const queryResult = Query.simple("UPDATE non_existent_table SET name = 'Test'")
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.update(query)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Failed to update")
      }
    })
  })

  describe("delete", () => {
    it("should delete entities matching query", () => {
      // Arrange
      const user1 = createUser({
        id: "user-1",
        email: "user1@example.com",
        status: "active",
      })
      const user2 = createUser({
        id: "user-2",
        email: "user2@example.com",
        status: "inactive",
      })

      repository.insertUser(user1)
      repository.insertUser(user2)

      const queryResult = Query.create(
        "DELETE FROM users WHERE status = :status",
        { status: "inactive" }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.delete(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBe(1)

        // Verify only one entity remains
        const countResult = repository.count()
        expect(countResult.isError).toBe(false)
        if (!countResult.isError) {
          expect(countResult.value).toBe(1)
        }
      }
    })

    it("should return 0 when no rows deleted", () => {
      // Arrange
      const queryResult = Query.create(
        "DELETE FROM users WHERE id = :id",
        { id: "non-existent" }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.delete(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBe(0)
      }
    })

    it("should delete multiple entities", () => {
      // Arrange
      const user1 = createUser({
        id: "user-1",
        email: "user1@example.com",
        status: "active",
      })
      const user2 = createUser({
        id: "user-2",
        email: "user2@example.com",
        status: "active",
      })
      const user3 = createUser({
        id: "user-3",
        email: "user3@example.com",
        status: "inactive",
      })

      repository.insertUser(user1)
      repository.insertUser(user2)
      repository.insertUser(user3)

      const queryResult = Query.create(
        "DELETE FROM users WHERE status = :status",
        { status: "active" }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.delete(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBe(2)

        // Verify only one entity remains
        const countResult = repository.count()
        expect(countResult.isError).toBe(false)
        if (!countResult.isError) {
          expect(countResult.value).toBe(1)
        }
      }
    })

    it("should handle database errors gracefully", () => {
      // Arrange - create invalid query
      const queryResult = Query.simple("DELETE FROM non_existent_table")
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.delete(query)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Failed to delete")
      }
    })
  })

  describe("deleteById", () => {
    it("should delete entity by ID", () => {
      // Arrange
      const user = createUser({ id: "user-123" })
      repository.insertUser(user)

      // Act
      const result = repository.deleteById("user-123")

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBe(true)

        // Verify entity was deleted
        const findResult = repository.findById("user-123")
        expect(findResult.isError).toBe(false)
        if (!findResult.isError) {
          expect(findResult.value).toBeNull()
        }
      }
    })

    it("should return false when entity does not exist", () => {
      // Act
      const result = repository.deleteById("non-existent")

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toBe(false)
      }
    })

    it("should handle database errors gracefully", () => {
      // Arrange - close connection to force error
      db.close()

      // Act
      const result = repository.deleteById("user-123")

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Failed to delete by ID")
      }
    })
  })

  describe("queryRaw", () => {
    it("should return raw rows without entity mapping", () => {
      // Arrange
      const user = createUser({
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
      })
      repository.insertUser(user)

      const queryResult = Query.simple("SELECT id, email FROM users")
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.queryRaw(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.length).toBe(1)
        const row = result.value[0] as Record<string, unknown>
        expect(row.id).toBe("user-1")
        expect(row.email).toBe("test@example.com")
        // Should have snake_case field names from database
        expect("created_at" in row).toBe(false) // We only selected id and email
      }
    })

    it("should handle queries with parameters", () => {
      // Arrange
      const user1 = createUser({
        id: "user-1",
        email: "user1@example.com",
        status: "active",
      })
      const user2 = createUser({
        id: "user-2",
        email: "user2@example.com",
        status: "inactive",
      })

      repository.insertUser(user1)
      repository.insertUser(user2)

      const queryResult = Query.create(
        "SELECT id, status FROM users WHERE status = :status",
        { status: "active" }
      )
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.queryRaw(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.length).toBe(1)
        const row = result.value[0] as Record<string, unknown>
        expect(row.id).toBe("user-1")
        expect(row.status).toBe("active")
      }
    })

    it("should return empty array when no results", () => {
      // Arrange
      const queryResult = Query.simple("SELECT * FROM users")
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.queryRaw(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value).toEqual([])
      }
    })

    it("should handle database errors gracefully", () => {
      // Arrange - create invalid query
      const queryResult = Query.simple("SELECT * FROM non_existent_table")
      const query = assertSuccess(queryResult)

      // Act
      const result = repository.queryRaw(query)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Failed to query raw")
      }
    })
  })

  describe("transactions", () => {
    it("should commit successful transaction", () => {
      // Arrange
      const user1 = createUser({ id: "user-1", email: "user1@example.com" })
      const user2 = createUser({ id: "user-2", email: "user2@example.com" })

      // Act
      repository.testBeginTransaction()

      const insertQuery1 = assertSuccess(
        Query.create(
          "INSERT INTO users (id, email, name, status, created_at) VALUES (:id, :email, :name, :status, :createdAt)",
          {
            id: user1.id,
            email: user1.email,
            name: user1.name,
            status: user1.status,
            createdAt: user1.createdAt,
          }
        )
      )
      repository.insert(insertQuery1)

      const insertQuery2 = assertSuccess(
        Query.create(
          "INSERT INTO users (id, email, name, status, created_at) VALUES (:id, :email, :name, :status, :createdAt)",
          {
            id: user2.id,
            email: user2.email,
            name: user2.name,
            status: user2.status,
            createdAt: user2.createdAt,
          }
        )
      )
      repository.insert(insertQuery2)

      repository.testCommit()

      // Assert
      const countResult = repository.count()
      expect(countResult.isError).toBe(false)
      if (!countResult.isError) {
        expect(countResult.value).toBe(2)
      }
    })

    it("should rollback failed transaction", () => {
      // Arrange
      const user1 = createUser({ id: "user-1", email: "user1@example.com" })

      // Act
      repository.testBeginTransaction()

      const insertQuery = assertSuccess(
        Query.create(
          "INSERT INTO users (id, email, name, status, created_at) VALUES (:id, :email, :name, :status, :createdAt)",
          {
            id: user1.id,
            email: user1.email,
            name: user1.name,
            status: user1.status,
            createdAt: user1.createdAt,
          }
        )
      )
      repository.insert(insertQuery)

      repository.testRollback()

      // Assert - changes should be rolled back
      const countResult = repository.count()
      expect(countResult.isError).toBe(false)
      if (!countResult.isError) {
        expect(countResult.value).toBe(0)
      }
    })

    it("should handle nested operations within transaction", () => {
      // Arrange
      const user = createUser({ id: "user-1", email: "user1@example.com" })

      // Act
      repository.testBeginTransaction()

      // Insert
      const insertQuery = assertSuccess(
        Query.create(
          "INSERT INTO users (id, email, name, status, created_at) VALUES (:id, :email, :name, :status, :createdAt)",
          {
            id: user.id,
            email: user.email,
            name: user.name,
            status: user.status,
            createdAt: user.createdAt,
          }
        )
      )
      repository.insert(insertQuery)

      // Update
      const updateQuery = assertSuccess(
        Query.create("UPDATE users SET name = :name WHERE id = :id", {
          id: user.id,
          name: "Updated Name",
        })
      )
      repository.update(updateQuery)

      repository.testCommit()

      // Assert
      const findResult = repository.findById("user-1")
      expect(findResult.isError).toBe(false)
      if (!findResult.isError) {
        expect(findResult.value?.name).toBe("Updated Name")
      }
    })
  })

  describe("getConnection", () => {
    it("should return database connection", () => {
      // Act
      const connection = repository.getConnection()

      // Assert
      expect(connection).toBeDefined()
      expect(typeof connection.prepare).toBe("function")
      expect(typeof connection.exec).toBe("function")
      expect(typeof connection.close).toBe("function")
    })

    it("should return same connection instance", () => {
      // Act
      const connection1 = repository.getConnection()
      const connection2 = repository.getConnection()

      // Assert
      expect(connection1).toBe(connection2)
    })
  })

  describe("multiple entities integration", () => {
    it("should handle full CRUD lifecycle", () => {
      // Create
      const user = createUser({
        id: "lifecycle-user",
        email: "lifecycle@example.com",
        name: "Lifecycle Test",
        status: "active",
      })

      const insertQuery = assertSuccess(
        Query.create(
          "INSERT INTO users (id, email, name, status, created_at) VALUES (:id, :email, :name, :status, :createdAt)",
          {
            id: user.id,
            email: user.email,
            name: user.name,
            status: user.status,
            createdAt: user.createdAt,
          }
        )
      )
      const insertResult = repository.insert(insertQuery)
      expect(insertResult.isError).toBe(false)

      // Read
      const findResult = repository.findById("lifecycle-user")
      expect(findResult.isError).toBe(false)
      if (!findResult.isError) {
        expect(findResult.value?.email).toBe("lifecycle@example.com")
      }

      // Update
      const updateQuery = assertSuccess(
        Query.create("UPDATE users SET name = :name WHERE id = :id", {
          id: "lifecycle-user",
          name: "Updated Lifecycle",
        })
      )
      const updateResult = repository.update(updateQuery)
      expect(updateResult.isError).toBe(false)
      if (!updateResult.isError) {
        expect(updateResult.value).toBe(1)
      }

      // Verify update
      const findUpdatedResult = repository.findById("lifecycle-user")
      expect(findUpdatedResult.isError).toBe(false)
      if (!findUpdatedResult.isError) {
        expect(findUpdatedResult.value?.name).toBe("Updated Lifecycle")
      }

      // Delete
      const deleteResult = repository.deleteById("lifecycle-user")
      expect(deleteResult.isError).toBe(false)
      if (!deleteResult.isError) {
        expect(deleteResult.value).toBe(true)
      }

      // Verify deletion
      const findDeletedResult = repository.findById("lifecycle-user")
      expect(findDeletedResult.isError).toBe(false)
      if (!findDeletedResult.isError) {
        expect(findDeletedResult.value).toBeNull()
      }
    })

    it("should handle batch operations efficiently", () => {
      // Arrange - create 10 users
      const users: User[] = []
      for (let i = 1; i <= 10; i++) {
        users.push(
          createUser({
            id: `batch-user-${i}`,
            email: `batch${i}@example.com`,
            name: `Batch User ${i}`,
            status: i % 2 === 0 ? "active" : "inactive",
          })
        )
      }

      // Insert all users
      for (const user of users) {
        const insertQuery = assertSuccess(
          Query.create(
            "INSERT INTO users (id, email, name, status, created_at) VALUES (:id, :email, :name, :status, :createdAt)",
            {
              id: user.id,
              email: user.email,
              name: user.name,
              status: user.status,
              createdAt: user.createdAt,
            }
          )
        )
        repository.insert(insertQuery)
      }

      // Verify count
      const countResult = repository.count()
      expect(countResult.isError).toBe(false)
      if (!countResult.isError) {
        expect(countResult.value).toBe(10)
      }

      // Query active users
      const activeQuery = assertSuccess(
        Query.create("SELECT * FROM users WHERE status = :status", {
          status: "active",
        })
      )
      const activeResult = repository.findByQuery(activeQuery)
      expect(activeResult.isError).toBe(false)
      if (!activeResult.isError) {
        expect(activeResult.value.length).toBe(5)
      }

      // Update all inactive to active
      const updateQuery = assertSuccess(
        Query.create("UPDATE users SET status = :newStatus WHERE status = :oldStatus", {
          newStatus: "active",
          oldStatus: "inactive",
        })
      )
      const updateResult = repository.update(updateQuery)
      expect(updateResult.isError).toBe(false)
      if (!updateResult.isError) {
        expect(updateResult.value).toBe(5)
      }

      // Verify all are active
      const allActiveResult = repository.findAll()
      expect(allActiveResult.isError).toBe(false)
      if (!allActiveResult.isError) {
        expect(allActiveResult.value.every((u) => u.status === "active")).toBe(true)
      }
    })

    it("should handle complex filtering and sorting", () => {
      // Arrange
      const users = [
        createUser({
          id: "user-1",
          email: "alice@example.com",
          name: "Alice",
          status: "active",
        }),
        createUser({
          id: "user-2",
          email: "bob@example.com",
          name: "Bob",
          status: "inactive",
        }),
        createUser({
          id: "user-3",
          email: "charlie@example.com",
          name: "Charlie",
          status: "active",
        }),
        createUser({
          id: "user-4",
          email: "diana@example.com",
          name: "Diana",
          status: "active",
        }),
      ]

      for (const user of users) {
        repository.insertUser(user)
      }

      // Act - find active users sorted by name
      const query = assertSuccess(
        Query.create(
          "SELECT * FROM users WHERE status = :status ORDER BY name ASC",
          { status: "active" }
        )
      )
      const result = repository.findByQuery(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.length).toBe(3)
        expect(result.value[0]?.name).toBe("Alice")
        expect(result.value[1]?.name).toBe("Charlie")
        expect(result.value[2]?.name).toBe("Diana")
      }
    })
  })

  describe("edge cases", () => {
    it("should handle empty strings in fields", () => {
      // Arrange
      const user = createUser({
        id: "empty-user",
        email: "empty@example.com",
        name: "",
        status: "active",
      })
      repository.insertUser(user)

      // Act
      const result = repository.findById("empty-user")

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value?.name).toBe("")
      }
    })

    it("should handle special characters in text fields", () => {
      // Arrange
      const user = createUser({
        id: "special-user",
        email: "special@example.com",
        name: "Test'User\"With<Special>Chars&More",
        status: "active",
      })
      repository.insertUser(user)

      // Act
      const result = repository.findById("special-user")

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value?.name).toBe("Test'User\"With<Special>Chars&More")
      }
    })

    it("should handle large text values", () => {
      // Arrange
      const largeName = "A".repeat(1000)
      const user = createUser({
        id: "large-user",
        email: "large@example.com",
        name: largeName,
        status: "active",
      })
      repository.insertUser(user)

      // Act
      const result = repository.findById("large-user")

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value?.name).toBe(largeName)
        expect(result.value?.name.length).toBe(1000)
      }
    })

    it("should handle query with LIMIT and OFFSET", () => {
      // Arrange
      for (let i = 1; i <= 5; i++) {
        const user = createUser({
          id: `user-${i}`,
          email: `user${i}@example.com`,
          name: `User ${i}`,
        })
        repository.insertUser(user)
      }

      // Act
      const query = assertSuccess(
        Query.simple("SELECT * FROM users ORDER BY id ASC LIMIT 2 OFFSET 2")
      )
      const result = repository.findByQuery(query)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.length).toBe(2)
        expect(result.value[0]?.id).toBe("user-3")
        expect(result.value[1]?.id).toBe("user-4")
      }
    })
  })
})
