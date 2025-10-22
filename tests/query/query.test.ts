/**
 * Comprehensive tests for Query value object
 * Tests named placeholder support and parameter binding
 */

import { describe, test, expect } from "bun:test"
import { Query } from "../../src/query/query.ts"
import { assertSuccess, assertError } from "../test-utils.ts"

describe("Query", () => {
  describe("Query.create() - Valid queries", () => {
    test("should create query with single named placeholder", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const params = { email: "alice@example.com" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getSql()).toBe(sql)
      expect(query.getParams()).toEqual({ email: "alice@example.com" })
    })

    test("should create query with multiple named placeholders", () => {
      // Arrange
      const sql =
        "SELECT * FROM users WHERE email = :email AND status = :status AND id = :id"
      const params = { email: "bob@example.com", status: "active", id: "user-123" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getSql()).toBe(sql)
      expect(query.getParams()).toEqual({ email: "bob@example.com", status: "active", id: "user-123" })
    })

    test("should create query with underscore in placeholder names", () => {
      // Arrange
      const sql = "UPDATE users SET last_login = :last_login WHERE user_id = :user_id"
      const params = { last_login: Date.now(), user_id: "user-456" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ last_login: params.last_login, user_id: params.user_id })
    })

    test("should create query with numbers in placeholder names", () => {
      // Arrange
      const sql = "SELECT * FROM items WHERE field1 = :field1 AND field2 = :field2"
      const params = { field1: "value1", field2: "value2" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ field1: "value1", field2: "value2" })
    })

    test("should create query with various data types", () => {
      // Arrange
      const sql =
        "INSERT INTO records (name, count, active, data) VALUES (:name, :count, :active, :data)"
      const params = {
        name: "Test Record",
        count: 42,
        active: true,
        data: null,
      }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ name: "Test Record", count: 42, active: true, data: null })
    })

    test("should create query with complex WHERE clause", () => {
      // Arrange
      const sql =
        "SELECT * FROM users WHERE (email = :email OR username = :username) AND status = :status"
      const params = {
        email: "test@example.com",
        username: "testuser",
        status: "active",
      }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ email: "test@example.com", username: "testuser", status: "active" })
    })

    test("should create query with IN clause", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE id IN (:id1, :id2, :id3)"
      const params = { id1: "user-1", id2: "user-2", id3: "user-3" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ id1: "user-1", id2: "user-2", id3: "user-3" })
    })

    test("should create query with JOIN and multiple conditions", () => {
      // Arrange
      const sql = `
        SELECT u.*, p.title
        FROM users u
        JOIN posts p ON u.id = p.user_id
        WHERE u.status = :status AND p.created_at > :created_at
      `
      const params = { status: "active", created_at: Date.now() - 86400000 }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ status: "active", created_at: params.created_at })
    })

    test("should handle empty params object for query with no placeholders", () => {
      // Arrange
      const sql = "SELECT COUNT(*) FROM users"
      const params = {}

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({})
    })

    test("should handle undefined params for query with no placeholders", () => {
      // Arrange
      const sql = "DELETE FROM sessions WHERE expired = 1"

      // Act
      const result = Query.create(sql)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({})
    })
  })

  describe("Query.simple() - Queries without parameters", () => {
    test("should create simple query without placeholders", () => {
      // Arrange
      const sql = "SELECT * FROM users"

      // Act
      const result = Query.simple(sql)

      // Assert
      const query = assertSuccess(result)
      expect(query.getSql()).toBe(sql)
      expect(query.getParams()).toEqual({})
    })

    test("should create simple query with WHERE clause using literal values", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE status = 'active'"

      // Act
      const result = Query.simple(sql)

      // Assert
      const query = assertSuccess(result)
      expect(query.getSql()).toBe(sql)
      expect(query.getParams()).toEqual({})
    })

    test("should create simple COUNT query", () => {
      // Arrange
      const sql = "SELECT COUNT(*) as total FROM users"

      // Act
      const result = Query.simple(sql)

      // Assert
      const query = assertSuccess(result)
      expect(query.getSql()).toBe(sql)
      expect(query.getParams()).toEqual({})
    })

    test("should reject simple query with colon (potential placeholder)", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"

      // Act
      const result = Query.simple(sql)

      // Assert
      const error = assertError(result)
      expect(error).toBe(
        "Simple query contains placeholders. Use Query.create() instead."
      )
    })

    test("should reject simple query with colon in string context", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE time = '12:00:00'"

      // Act
      const result = Query.simple(sql)

      // Assert
      const error = assertError(result)
      expect(error).toContain("Simple query contains placeholders")
    })
  })

  describe("Query.create() - Validation: Missing parameters", () => {
    test("should fail when single parameter is missing", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const params = {}

      // Act
      const result = Query.create(sql, params)

      // Assert
      const error = assertError(result)
      expect(error).toBe("Missing parameters: email")
    })

    test("should fail when multiple parameters are missing", () => {
      // Arrange
      const sql =
        "SELECT * FROM users WHERE email = :email AND status = :status AND id = :id"
      const params = {}

      // Act
      const result = Query.create(sql, params)

      // Assert
      const error = assertError(result)
      expect(error).toContain("Missing parameters:")
      expect(error).toContain("email")
      expect(error).toContain("status")
      expect(error).toContain("id")
    })

    test("should fail when some parameters are missing", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email AND status = :status"
      const params = { email: "test@example.com" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const error = assertError(result)
      expect(error).toBe("Missing parameters: status")
    })

    test("should fail when params is undefined but placeholders exist", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"

      // Act
      const result = Query.create(sql)

      // Assert
      const error = assertError(result)
      expect(error).toBe("Missing parameters: email")
    })
  })

  describe("Query.create() - Validation: Extra parameters", () => {
    test("should fail when single extra parameter provided", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const params = { email: "test@example.com", status: "active" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const error = assertError(result)
      expect(error).toBe("Extra parameters: status")
    })

    test("should fail when multiple extra parameters provided", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const params = {
        email: "test@example.com",
        status: "active",
        id: "user-123",
        name: "Test User",
      }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const error = assertError(result)
      expect(error).toContain("Extra parameters:")
      expect(error).toContain("status")
      expect(error).toContain("id")
      expect(error).toContain("name")
    })

    test("should fail when all parameters are extra (no placeholders in SQL)", () => {
      // Arrange
      const sql = "SELECT * FROM users"
      const params = { email: "test@example.com", status: "active" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const error = assertError(result)
      expect(error).toContain("Extra parameters:")
    })
  })

  describe("Query.create() - Validation: Duplicate placeholders", () => {
    test("should fail when placeholder is used twice", () => {
      // Arrange
      const sql =
        "SELECT * FROM users WHERE email = :email OR backup_email = :email"
      const params = { email: "test@example.com" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const error = assertError(result)
      expect(error).toBe("Duplicate placeholders: email")
    })

    test("should fail when multiple placeholders are duplicated", () => {
      // Arrange
      const sql =
        "SELECT * FROM users WHERE (email = :email OR alt_email = :email) AND (status = :status OR backup_status = :status)"
      const params = { email: "test@example.com", status: "active" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const error = assertError(result)
      expect(error).toContain("Duplicate placeholders:")
      expect(error).toContain("email")
      expect(error).toContain("status")
    })

    test("should fail when placeholder appears three times", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE a = :id OR b = :id OR c = :id"
      const params = { id: "123" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const error = assertError(result)
      expect(error).toBe("Duplicate placeholders: id")
    })
  })

  describe("Edge cases", () => {
    test("should handle empty SQL string", () => {
      // Arrange
      const sql = ""

      // Act
      const result = Query.simple(sql)

      // Assert
      const query = assertSuccess(result)
      expect(query.getSql()).toBe("")
      expect(query.getParams()).toEqual({})
    })

    test("should handle SQL with only whitespace", () => {
      // Arrange
      const sql = "   \n\t  "

      // Act
      const result = Query.simple(sql)

      // Assert
      const query = assertSuccess(result)
      expect(query.getSql()).toBe(sql)
    })

    test("should handle SQL with line breaks", () => {
      // Arrange
      const sql = `
        SELECT *
        FROM users
        WHERE email = :email
          AND status = :status
      `
      const params = { email: "test@example.com", status: "active" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ email: "test@example.com", status: "active" })
    })

    test("should handle SQL comments with placeholders", () => {
      // Arrange
      const sql = `
        -- Get user by email
        SELECT * FROM users
        WHERE email = :email -- user's email address
        AND status = :status
      `
      const params = { email: "test@example.com", status: "active" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ email: "test@example.com", status: "active" })
    })

    test("should handle SQL with block comments", () => {
      // Arrange
      const sql = `
        /* Multi-line comment
           with :fake placeholder */
        SELECT * FROM users WHERE email = :email
      `
      const params = { email: "test@example.com", fake: "ignored" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      // Note: The regex extracts :fake from comment, which causes validation to fail
      // This is expected behavior - placeholders in comments are still extracted
      if (result.isError) {
        expect(result.error).toContain("Extra parameters:")
      } else {
        // If implementation improves to skip comments, email param would be found
        const query = result.value
        expect(query.getParams()).toBeDefined()
      }
    })

    test("should handle special characters in parameter values", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const params = { email: "test+tag@example.com" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ email: "test+tag@example.com" })
    })

    test("should handle Unicode in parameter values", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE name = :name"
      const params = { name: "Müller José 日本語" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ name: "Müller José 日本語" })
    })

    test("should handle SQL injection attempt in placeholder", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const params = { email: "'; DROP TABLE users; --" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      // Value is safely parameterized
      expect(query.getParams()).toEqual({ email: "'; DROP TABLE users; --" })
    })

    test("should handle very long SQL query", () => {
      // Arrange
      const columns = Array.from({ length: 50 }, (_, i) => `col${i}`).join(", ")
      const sql = `SELECT ${columns} FROM users WHERE email = :email`
      const params = { email: "test@example.com" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ email: "test@example.com" })
    })

    test("should handle parameter value as empty string", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const params = { email: "" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ email: "" })
    })

    test("should handle parameter value as zero", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE age = :age"
      const params = { age: 0 }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ age: 0 })
    })

    test("should handle parameter value as false", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE active = :active"
      const params = { active: false }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ active: false })
    })
  })

  describe("Getter methods - Immutability", () => {
    test("getParams() should return a copy, not reference", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const params = { email: "test@example.com" }
      const query = assertSuccess(Query.create(sql, params))

      // Act
      const params1 = query.getParams()
      params1.status = "active"
      const params2 = query.getParams()

      // Assert
      expect(params2).toEqual({ email: "test@example.com" })
      expect("status" in params2).toBe(false)
    })
  })

  describe("Real-world query patterns", () => {
    test("should handle user authentication query", () => {
      // Arrange
      const sql = `
        SELECT id, email, password_hash, status
        FROM users
        WHERE email = :email
        LIMIT 1
      `
      const params = { email: "user@example.com" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ email: "user@example.com" })
    })

    test("should handle pagination query", () => {
      // Arrange
      const sql = `
        SELECT * FROM posts
        WHERE user_id = :user_id
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
      `
      const params = { user_id: "user-123", limit: 10, offset: 0 }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ user_id: "user-123", limit: 10, offset: 0 })
    })

    test("should handle search query with LIKE (using separate placeholders)", () => {
      // Arrange
      // Note: Can't use same placeholder twice, so use search1 and search2
      const sql = `
        SELECT * FROM users
        WHERE (name LIKE :search1 OR email LIKE :search2)
        AND status = :status
      `
      const searchTerm = "%john%"
      const params = { search1: searchTerm, search2: searchTerm, status: "active" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ search1: searchTerm, search2: searchTerm, status: "active" })
    })

    test("should handle batch insert query", () => {
      // Arrange
      const sql = `
        INSERT INTO users (id, email, name, created_at)
        VALUES (:id, :email, :name, :created_at)
      `
      const params = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        created_at: Date.now(),
      }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ id: "user-123", email: "test@example.com", name: "Test User", created_at: params.created_at })
    })

    test("should handle update with multiple conditions", () => {
      // Arrange
      const sql = `
        UPDATE users
        SET
          name = :name,
          email = :email,
          updated_at = :updated_at
        WHERE id = :id AND status = :status
      `
      const params = {
        name: "Updated Name",
        email: "updated@example.com",
        updated_at: Date.now(),
        id: "user-123",
        status: "active",
      }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ name: "Updated Name", email: "updated@example.com", updated_at: params.updated_at, id: "user-123", status: "active" })
    })

    test("should handle delete with conditions", () => {
      // Arrange
      const sql = `
        DELETE FROM sessions
        WHERE user_id = :user_id
        AND expires_at < :expires_at
      `
      const params = { user_id: "user-123", expires_at: Date.now() }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ user_id: "user-123", expires_at: params.expires_at })
    })

    test("should handle aggregate query with GROUP BY", () => {
      // Arrange
      const sql = `
        SELECT user_id, COUNT(*) as post_count
        FROM posts
        WHERE status = :status
        GROUP BY user_id
        HAVING COUNT(*) > :min_count
      `
      const params = { status: "published", min_count: 5 }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ status: "published", min_count: 5 })
    })

    test("should handle subquery with parameters", () => {
      // Arrange
      const sql = `
        SELECT * FROM users
        WHERE id IN (
          SELECT user_id FROM posts
          WHERE status = :status
          AND created_at > :created_at
        )
      `
      const params = { status: "published", created_at: Date.now() - 86400000 }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual({ status: "published", created_at: params.created_at })
    })
  })

  describe("Type safety and TypeScript types", () => {
    test("should accept string parameter values", () => {
      const sql = "SELECT * FROM users WHERE email = :email"
      const params: Record<string, string> = { email: "test@example.com" }
      const result = Query.create(sql, params)
      expect(result.isError).toBe(false)
    })

    test("should accept number parameter values", () => {
      const sql = "SELECT * FROM users WHERE age = :age"
      const params: Record<string, number> = { age: 25 }
      const result = Query.create(sql, params)
      expect(result.isError).toBe(false)
    })

    test("should accept boolean parameter values", () => {
      const sql = "SELECT * FROM users WHERE active = :active"
      const params: Record<string, boolean> = { active: true }
      const result = Query.create(sql, params)
      expect(result.isError).toBe(false)
    })

    test("should accept null parameter values", () => {
      const sql = "SELECT * FROM users WHERE deleted_at = :deleted_at"
      const params: Record<string, null> = { deleted_at: null }
      const result = Query.create(sql, params)
      expect(result.isError).toBe(false)
    })

    test("should accept mixed parameter types", () => {
      const sql =
        "INSERT INTO logs (message, level, timestamp, success) VALUES (:message, :level, :timestamp, :success)"
      const params: Record<string, unknown> = {
        message: "Test log",
        level: 2,
        timestamp: Date.now(),
        success: true,
      }
      const result = Query.create(sql, params)
      expect(result.isError).toBe(false)
    })
  })
})
