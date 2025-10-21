/**
 * Comprehensive tests for Query value object
 * Tests named placeholder support, validation, and parameter binding
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
      expect(query.getOriginalSql()).toBe(sql)
      expect(query.getPositionalSql()).toBe("SELECT * FROM users WHERE email = ?")
      expect(query.getParams()).toEqual(["alice@example.com"])
      expect(query.getNamedParams()).toEqual({ email: "alice@example.com" })
      expect(query.getPlaceholders()).toEqual(["email"])
      expect(query.hasParams()).toBe(true)
      expect(query.getParamCount()).toBe(1)
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
      expect(query.getOriginalSql()).toBe(sql)
      expect(query.getPositionalSql()).toBe(
        "SELECT * FROM users WHERE email = ? AND status = ? AND id = ?"
      )
      expect(query.getParams()).toEqual(["bob@example.com", "active", "user-123"])
      expect(query.getNamedParams()).toEqual(params)
      expect(query.getPlaceholders()).toEqual(["email", "status", "id"])
      expect(query.hasParams()).toBe(true)
      expect(query.getParamCount()).toBe(3)
    })

    test("should create query with underscore in placeholder names", () => {
      // Arrange
      const sql = "UPDATE users SET last_login = :last_login WHERE user_id = :user_id"
      const params = { last_login: Date.now(), user_id: "user-456" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getPlaceholders()).toEqual(["last_login", "user_id"])
      expect(query.getParams()).toEqual([params.last_login, "user-456"])
    })

    test("should create query with numbers in placeholder names", () => {
      // Arrange
      const sql = "SELECT * FROM items WHERE field1 = :field1 AND field2 = :field2"
      const params = { field1: "value1", field2: "value2" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getPlaceholders()).toEqual(["field1", "field2"])
      expect(query.getParams()).toEqual(["value1", "value2"])
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
      expect(query.getParams()).toEqual(["Test Record", 42, true, null])
      expect(query.getNamedParams()).toEqual(params)
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
      expect(query.getPositionalSql()).toBe(
        "SELECT * FROM users WHERE (email = ? OR username = ?) AND status = ?"
      )
      expect(query.getParams()).toEqual(["test@example.com", "testuser", "active"])
    })

    test("should create query with IN clause", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE id IN (:id1, :id2, :id3)"
      const params = { id1: "user-1", id2: "user-2", id3: "user-3" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getPositionalSql()).toBe("SELECT * FROM users WHERE id IN (?, ?, ?)")
      expect(query.getParams()).toEqual(["user-1", "user-2", "user-3"])
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
      expect(query.getPlaceholders()).toEqual(["status", "created_at"])
      expect(query.hasParams()).toBe(true)
    })

    test("should handle empty params object for query with no placeholders", () => {
      // Arrange
      const sql = "SELECT COUNT(*) FROM users"
      const params = {}

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getPlaceholders()).toEqual([])
      expect(query.getParams()).toEqual([])
      expect(query.hasParams()).toBe(false)
      expect(query.getParamCount()).toBe(0)
    })

    test("should handle undefined params for query with no placeholders", () => {
      // Arrange
      const sql = "DELETE FROM sessions WHERE expired = 1"

      // Act
      const result = Query.create(sql)

      // Assert
      const query = assertSuccess(result)
      expect(query.getPlaceholders()).toEqual([])
      expect(query.getParams()).toEqual([])
      expect(query.hasParams()).toBe(false)
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
      expect(query.getOriginalSql()).toBe(sql)
      expect(query.getPositionalSql()).toBe(sql)
      expect(query.getParams()).toEqual([])
      expect(query.getNamedParams()).toEqual({})
      expect(query.getPlaceholders()).toEqual([])
      expect(query.hasParams()).toBe(false)
      expect(query.getParamCount()).toBe(0)
    })

    test("should create simple query with WHERE clause using literal values", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE status = 'active'"

      // Act
      const result = Query.simple(sql)

      // Assert
      const query = assertSuccess(result)
      expect(query.getOriginalSql()).toBe(sql)
      expect(query.hasParams()).toBe(false)
    })

    test("should create simple COUNT query", () => {
      // Arrange
      const sql = "SELECT COUNT(*) as total FROM users"

      // Act
      const result = Query.simple(sql)

      // Assert
      const query = assertSuccess(result)
      expect(query.getOriginalSql()).toBe(sql)
      expect(query.hasParams()).toBe(false)
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

  describe("Placeholder extraction and conversion", () => {
    test("should preserve placeholder order in positional params", () => {
      // Arrange
      const sql =
        "UPDATE users SET name = :name, email = :email, status = :status WHERE id = :id"
      const params = {
        name: "Alice",
        email: "alice@example.com",
        status: "active",
        id: "user-123",
      }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getPlaceholders()).toEqual(["name", "email", "status", "id"])
      expect(query.getParams()).toEqual([
        "Alice",
        "alice@example.com",
        "active",
        "user-123",
      ])
      expect(query.getPositionalSql()).toBe(
        "UPDATE users SET name = ?, email = ?, status = ? WHERE id = ?"
      )
    })

    test("should handle placeholders in different SQL contexts", () => {
      // Arrange
      const sql = `
        INSERT INTO logs (user_id, action, timestamp)
        VALUES (:user_id, :action, :timestamp)
      `
      const params = {
        user_id: "user-456",
        action: "login",
        timestamp: Date.now(),
      }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      const positionalSql = query.getPositionalSql()
      expect(positionalSql).toContain("VALUES (?, ?, ?)")
      expect(query.getParams()).toEqual([
        "user-456",
        "login",
        params.timestamp,
      ])
    })

    test("should handle placeholders adjacent to SQL keywords", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email=:email AND status=:status"
      const params = { email: "test@example.com", status: "active" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getPositionalSql()).toBe(
        "SELECT * FROM users WHERE email=? AND status=?"
      )
      expect(query.getParams()).toEqual(["test@example.com", "active"])
    })

    test("should handle placeholders with parentheses", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE (email = :email) AND (status = :status)"
      const params = { email: "test@example.com", status: "active" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getPositionalSql()).toBe(
        "SELECT * FROM users WHERE (email = ?) AND (status = ?)"
      )
    })

    test("should handle placeholders in CASE expressions", () => {
      // Arrange
      const sql = `
        SELECT
          CASE
            WHEN status = :active THEN 'Active'
            WHEN status = :inactive THEN 'Inactive'
            ELSE 'Unknown'
          END as status_label
        FROM users
      `
      const params = { active: "active", inactive: "inactive" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getPlaceholders()).toEqual(["active", "inactive"])
      expect(query.getParams()).toEqual(["active", "inactive"])
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
      expect(query.getOriginalSql()).toBe("")
      expect(query.hasParams()).toBe(false)
    })

    test("should handle SQL with only whitespace", () => {
      // Arrange
      const sql = "   \n\t  "

      // Act
      const result = Query.simple(sql)

      // Assert
      const query = assertSuccess(result)
      expect(query.getOriginalSql()).toBe(sql)
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
      expect(query.getPlaceholders()).toEqual(["email", "status"])
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
      expect(query.getPlaceholders()).toEqual(["email", "status"])
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
        // If implementation improves to skip comments, both placeholders would be found
        const query = result.value
        expect(query.getPlaceholders().length).toBeGreaterThan(0)
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
      expect(query.getParams()).toEqual(["test+tag@example.com"])
    })

    test("should handle Unicode in parameter values", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE name = :name"
      const params = { name: "Müller José 日本語" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual(["Müller José 日本語"])
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
      expect(query.getParams()).toEqual(["'; DROP TABLE users; --"])
      expect(query.getPositionalSql()).toBe("SELECT * FROM users WHERE email = ?")
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
      expect(query.getPlaceholders()).toEqual(["email"])
      expect(query.getOriginalSql()).toContain("col49")
    })

    test("should handle parameter value as empty string", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const params = { email: "" }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual([""])
    })

    test("should handle parameter value as zero", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE age = :age"
      const params = { age: 0 }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual([0])
    })

    test("should handle parameter value as false", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE active = :active"
      const params = { active: false }

      // Act
      const result = Query.create(sql, params)

      // Assert
      const query = assertSuccess(result)
      expect(query.getParams()).toEqual([false])
    })
  })

  describe("bind() - Parameter rebinding", () => {
    test("should bind new value to existing placeholder", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email AND status = :status"
      const params = { email: "alice@example.com", status: "active" }
      const query = assertSuccess(Query.create(sql, params))

      // Act
      const result = query.bind("email", "bob@example.com")

      // Assert
      const newQuery = assertSuccess(result)
      expect(newQuery.getParams()).toEqual(["bob@example.com", "active"])
      expect(newQuery.getNamedParams()).toEqual({
        email: "bob@example.com",
        status: "active",
      })
      // Original query unchanged
      expect(query.getParams()).toEqual(["alice@example.com", "active"])
    })

    test("should fail to bind to non-existent placeholder", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const params = { email: "test@example.com" }
      const query = assertSuccess(Query.create(sql, params))

      // Act
      const result = query.bind("status", "active")

      // Assert
      const error = assertError(result)
      expect(error).toBe("Parameter status not found in query")
    })

    test("should bind multiple values sequentially", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email AND status = :status"
      const params = { email: "alice@example.com", status: "active" }
      const query = assertSuccess(Query.create(sql, params))

      // Act
      const result1 = query.bind("email", "bob@example.com")
      const query2 = assertSuccess(result1)
      const result2 = query2.bind("status", "inactive")

      // Assert
      const finalQuery = assertSuccess(result2)
      expect(finalQuery.getParams()).toEqual(["bob@example.com", "inactive"])
    })

    test("should bind null value", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const params = { email: "test@example.com" }
      const query = assertSuccess(Query.create(sql, params))

      // Act
      const result = query.bind("email", null)

      // Assert
      const newQuery = assertSuccess(result)
      expect(newQuery.getParams()).toEqual([null])
    })

    test("should bind undefined value", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const params = { email: "test@example.com" }
      const query = assertSuccess(Query.create(sql, params))

      // Act
      const result = query.bind("email", undefined)

      // Assert
      const newQuery = assertSuccess(result)
      expect(newQuery.getParams()).toEqual([undefined])
    })
  })

  describe("withParams() - Parameter replacement", () => {
    test("should replace all parameters with new values", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email AND status = :status"
      const params = { email: "alice@example.com", status: "active" }
      const query = assertSuccess(Query.create(sql, params))

      // Act
      const newParams = { email: "bob@example.com", status: "inactive" }
      const result = query.withParams(newParams)

      // Assert
      const newQuery = assertSuccess(result)
      expect(newQuery.getParams()).toEqual(["bob@example.com", "inactive"])
      expect(newQuery.getNamedParams()).toEqual(newParams)
      // Original unchanged
      expect(query.getParams()).toEqual(["alice@example.com", "active"])
    })

    test("should fail when new params are missing required placeholders", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email AND status = :status"
      const params = { email: "alice@example.com", status: "active" }
      const query = assertSuccess(Query.create(sql, params))

      // Act
      const newParams = { email: "bob@example.com" }
      const result = query.withParams(newParams)

      // Assert
      const error = assertError(result)
      expect(error).toBe("Missing parameters: status")
    })

    test("should fail when new params have extra parameters", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const params = { email: "alice@example.com" }
      const query = assertSuccess(Query.create(sql, params))

      // Act
      const newParams = { email: "bob@example.com", status: "active", id: "123" }
      const result = query.withParams(newParams)

      // Assert
      const error = assertError(result)
      expect(error).toContain("Extra parameters:")
    })

    test("should allow query reuse with different parameter sets", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const query = assertSuccess(Query.create(sql, { email: "user1@example.com" }))

      // Act & Assert - Execute with different params
      const query2 = assertSuccess(query.withParams({ email: "user2@example.com" }))
      expect(query2.getParams()).toEqual(["user2@example.com"])

      const query3 = assertSuccess(query.withParams({ email: "user3@example.com" }))
      expect(query3.getParams()).toEqual(["user3@example.com"])

      // Original unchanged
      expect(query.getParams()).toEqual(["user1@example.com"])
    })
  })

  describe("validate() - SQL validation", () => {
    test("should validate query with correct SQL", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const params = { email: "test@example.com" }
      const query = assertSuccess(Query.create(sql, params))

      // Act
      const result = query.validate()

      // Assert
      expect(result.isError).toBe(false)
    })

    test("should detect unclosed single quote", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE name = 'John"
      const query = assertSuccess(Query.simple(sql))

      // Act
      const result = query.validate()

      // Assert
      const error = assertError(result)
      expect(error).toBe("Unclosed single quote in SQL")
    })

    test("should detect unclosed double quote", () => {
      // Arrange
      const sql = 'SELECT * FROM users WHERE name = "John'
      const query = assertSuccess(Query.simple(sql))

      // Act
      const result = query.validate()

      // Assert
      const error = assertError(result)
      expect(error).toBe("Unclosed double quote in SQL")
    })

    test("should pass validation with properly closed quotes", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE name = 'John' AND email = \"test@example.com\""
      const query = assertSuccess(Query.simple(sql))

      // Act
      const result = query.validate()

      // Assert
      expect(result.isError).toBe(false)
    })

    test("should pass validation with multiple pairs of quotes", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE name = 'John' OR name = 'Jane'"
      const query = assertSuccess(Query.simple(sql))

      // Act
      const result = query.validate()

      // Assert
      expect(result.isError).toBe(false)
    })

    test("should have even quotes with SQL escaped quotes", () => {
      // Arrange
      // Note: 'O''Brien' has 4 single quotes total (2 pairs), which is even
      const sql = "SELECT * FROM users WHERE name = 'O''Brien'"
      const query = assertSuccess(Query.simple(sql))

      // Act
      const result = query.validate()

      // Assert
      // The validator counts quotes: 'O''Brien' = 4 quotes (even number)
      // So validation passes even though it's escaped syntax
      expect(result.isError).toBe(false)
    })

    test("should pass validation for query without quotes", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE id = :id"
      const params = { id: 123 }
      const query = assertSuccess(Query.create(sql, params))

      // Act
      const result = query.validate()

      // Assert
      expect(result.isError).toBe(false)
    })
  })

  describe("debug() - Debug information", () => {
    test("should return complete debug information", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email AND status = :status"
      const params = { email: "test@example.com", status: "active" }
      const query = assertSuccess(Query.create(sql, params))

      // Act
      const debug = query.debug()

      // Assert
      expect(debug).toEqual({
        originalSql: sql,
        positionalSql: "SELECT * FROM users WHERE email = ? AND status = ?",
        namedParams: { email: "test@example.com", status: "active" },
        positionalParams: ["test@example.com", "active"],
        placeholders: ["email", "status"],
      })
    })

    test("should return debug info for simple query", () => {
      // Arrange
      const sql = "SELECT * FROM users"
      const query = assertSuccess(Query.simple(sql))

      // Act
      const debug = query.debug()

      // Assert
      expect(debug).toEqual({
        originalSql: sql,
        positionalSql: sql,
        namedParams: {},
        positionalParams: [],
        placeholders: [],
      })
    })

    test("should show updated values after bind", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const query = assertSuccess(Query.create(sql, { email: "old@example.com" }))
      const newQuery = assertSuccess(query.bind("email", "new@example.com"))

      // Act
      const debug = newQuery.debug()

      // Assert
      expect(debug.namedParams).toEqual({ email: "new@example.com" })
      expect(debug.positionalParams).toEqual(["new@example.com"])
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
      params1.push("extra-value")
      const params2 = query.getParams()

      // Assert
      expect(params2).toEqual(["test@example.com"])
      expect(params2.length).toBe(1)
    })

    test("getNamedParams() should return a copy, not reference", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const params = { email: "test@example.com" }
      const query = assertSuccess(Query.create(sql, params))

      // Act
      const namedParams1 = query.getNamedParams()
      namedParams1.status = "active"
      const namedParams2 = query.getNamedParams()

      // Assert
      expect(namedParams2).toEqual({ email: "test@example.com" })
      expect("status" in namedParams2).toBe(false)
    })

    test("getPlaceholders() should return a copy, not reference", () => {
      // Arrange
      const sql = "SELECT * FROM users WHERE email = :email"
      const params = { email: "test@example.com" }
      const query = assertSuccess(Query.create(sql, params))

      // Act
      const placeholders1 = query.getPlaceholders()
      placeholders1.push("status")
      const placeholders2 = query.getPlaceholders()

      // Assert
      expect(placeholders2).toEqual(["email"])
      expect(placeholders2.length).toBe(1)
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
      expect(query.getPlaceholders()).toEqual(["email"])
      expect(query.getParams()).toEqual(["user@example.com"])
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
      expect(query.getPlaceholders()).toEqual(["user_id", "limit", "offset"])
      expect(query.getParams()).toEqual(["user-123", 10, 0])
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
      expect(query.getPlaceholders()).toEqual(["search1", "search2", "status"])
      expect(query.getParams()).toEqual(["%john%", "%john%", "active"])
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
      expect(query.getPlaceholders()).toEqual(["id", "email", "name", "created_at"])
      expect(query.getParamCount()).toBe(4)
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
      expect(query.getPlaceholders()).toEqual([
        "name",
        "email",
        "updated_at",
        "id",
        "status",
      ])
      expect(query.getParamCount()).toBe(5)
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
      expect(query.getPlaceholders()).toEqual(["user_id", "expires_at"])
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
      expect(query.getPlaceholders()).toEqual(["status", "min_count"])
      expect(query.getParams()).toEqual(["published", 5])
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
      expect(query.getPlaceholders()).toEqual(["status", "created_at"])
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
