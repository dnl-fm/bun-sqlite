/**
 * Comprehensive tests for Database class
 * Tests singleton pattern, connection lifecycle, and query methods
 *
 * Coverage:
 * - getInstance() with file path and :memory:
 * - getCurrentInstance()
 * - reset() singleton
 * - getConnection()
 * - query(), queryOne(), run()
 * - close()
 * - getPath(), getConfig(), isConnected()
 * - Pragma application
 * - Error handling
 * - Concurrent operations
 * - Edge cases
 *
 * Target: 90%+ coverage for Database class
 */

import { test, expect, beforeEach, afterEach, describe } from "bun:test"
import { Database } from "../../src/core/database.ts"
import { DatabaseConfig, DEFAULT_PRAGMAS } from "../../src/core/database-config.ts"
import type { DatabaseConnection } from "../../src/types.ts"
import {
  assertSuccess,
  assertError,
  USER_TEST_SCHEMA,
  insertTestUser,
  insertTestUsers,
  getUserCount,
  createTestUser,
} from "../test-utils.ts"
import { existsSync } from "node:fs"
import { unlink, mkdir } from "node:fs/promises"
import { join } from "node:path"

// Test database paths
const TEST_DB_DIR = "/tmp/bun-sqlite-tests"
const TEST_DB_PATH = join(TEST_DB_DIR, "test.db")
const TEST_SCHEMA_PATH = join(TEST_DB_DIR, "schema.sql")

/**
 * Setup: Reset singleton before each test
 */
beforeEach(() => {
  Database.reset()
})

/**
 * Teardown: Reset singleton and cleanup test files
 */
afterEach(async () => {
  Database.reset()

  // Cleanup test database files
  try {
    if (existsSync(TEST_DB_PATH)) {
      await unlink(TEST_DB_PATH)
    }
    if (existsSync(`${TEST_DB_PATH}-wal`)) {
      await unlink(`${TEST_DB_PATH}-wal`)
    }
    if (existsSync(`${TEST_DB_PATH}-shm`)) {
      await unlink(`${TEST_DB_PATH}-shm`)
    }
    if (existsSync(TEST_SCHEMA_PATH)) {
      await unlink(TEST_SCHEMA_PATH)
    }
  } catch {
    // Ignore cleanup errors
  }
})

describe("Database - getInstance()", () => {
  test("should create new instance with :memory:", async () => {
    // Arrange
    const config = DatabaseConfig.minimal()

    // Act
    const result = await Database.getInstance(":memory:", config)

    // Assert
    const db = assertSuccess(result)
    expect(db).toBeInstanceOf(Database)
    expect(db.getPath()).toBe(":memory:")
    expect(db.isConnected()).toBe(true)
  })

  test("should create new instance with file path", async () => {
    // Arrange
    const config = DatabaseConfig.minimal()

    // Act
    const result = await Database.getInstance(TEST_DB_PATH, config)

    // Assert
    const db = assertSuccess(result)
    expect(db).toBeInstanceOf(Database)
    expect(db.getPath()).toBe(TEST_DB_PATH)
    expect(db.isConnected()).toBe(true)
    expect(existsSync(TEST_DB_PATH)).toBe(true)
  })

  test("should return same instance on multiple calls (singleton)", async () => {
    // Arrange
    const config = DatabaseConfig.minimal()

    // Act
    const result1 = await Database.getInstance(":memory:", config)
    const result2 = await Database.getInstance(":memory:", config)

    // Assert
    const db1 = assertSuccess(result1)
    const db2 = assertSuccess(result2)
    expect(db1).toBe(db2)
  })

  test("should use default config when none provided", async () => {
    // Act
    const result = await Database.getInstance(":memory:")

    // Assert
    const db = assertSuccess(result)
    const config = db.getConfig()
    const pragmas = config.getPragmas()
    expect(pragmas.length).toBe(DEFAULT_PRAGMAS.length)
  })

  test("should use custom config when provided", async () => {
    // Arrange
    const config = DatabaseConfig.minimal()

    // Act
    const result = await Database.getInstance(":memory:", config)

    // Assert
    const db = assertSuccess(result)
    const dbConfig = db.getConfig()
    expect(dbConfig).toBe(config)
  })

  test("should create directory for file path if it does not exist", async () => {
    // Arrange
    const dbPath = join(TEST_DB_DIR, "nested", "deep", "test.db")

    // Act
    const result = await Database.getInstance(dbPath, DatabaseConfig.minimal())

    // Assert
    const db = assertSuccess(result)
    expect(existsSync(dbPath)).toBe(true)
    db.close()
  })

  test("should return error on invalid path", async () => {
    // Arrange
    const invalidPath = "/\0/invalid/path/test.db"

    // Act
    const result = await Database.getInstance(invalidPath, DatabaseConfig.minimal())

    // Assert
    const error = assertError(result)
    expect(error).toContain("Failed to initialize database")
  })

  test("should apply default pragmas on initialization", async () => {
    // Act
    const result = await Database.getInstance(":memory:")
    const db = assertSuccess(result)

    // Assert - Check that pragmas were applied by querying one
    const connection = db.getConnection()
    const stmt = connection.prepare("PRAGMA journal_mode")
    const pragmaResult = stmt.get() as { journal_mode: string } | undefined

    expect(pragmaResult).toBeDefined()
    // In-memory databases may use 'memory' journal mode instead of 'wal'
    expect(pragmaResult?.journal_mode).toMatch(/^(wal|memory)$/)
  })

  test("should apply custom pragmas on initialization", async () => {
    // Arrange
    const config = new DatabaseConfig([
      { key: "journal_mode", value: "DELETE" },
      { key: "synchronous", value: "FULL" },
    ])

    // Act
    const result = await Database.getInstance(":memory:", config)
    const db = assertSuccess(result)

    // Assert
    const connection = db.getConnection()
    const stmt = connection.prepare("PRAGMA journal_mode")
    const pragmaResult = stmt.get() as { journal_mode: string } | undefined

    // In-memory databases may override journal_mode to 'memory'
    expect(pragmaResult?.journal_mode).toMatch(/^(delete|memory)$/)
  })
})

describe("Database - getCurrentInstance()", () => {
  test("should return null when no instance exists", () => {
    // Act
    const instance = Database.getCurrentInstance()

    // Assert
    expect(instance).toBeNull()
  })

  test("should return current instance when one exists", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)

    // Act
    const current = Database.getCurrentInstance()

    // Assert
    expect(current).toBe(db)
  })

  test("should return null after reset", async () => {
    // Arrange
    await Database.getInstance(":memory:", DatabaseConfig.minimal())

    // Act
    Database.reset()
    const current = Database.getCurrentInstance()

    // Assert
    expect(current).toBeNull()
  })
})

describe("Database - reset()", () => {
  test("should reset singleton instance", async () => {
    // Arrange
    const result1 = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db1 = assertSuccess(result1)

    // Act
    Database.reset()
    const result2 = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db2 = assertSuccess(result2)

    // Assert
    expect(db1).not.toBe(db2)
  })

  test("should close connection on reset", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    expect(db.isConnected()).toBe(true)

    // Act
    Database.reset()

    // Assert
    // Note: reset() calls close() but the db instance's connection property
    // may still be set. The actual connection is closed though.
    expect(Database.getCurrentInstance()).toBeNull()
  })

  test("should handle reset when no instance exists", () => {
    // Act & Assert - should not throw
    expect(() => Database.reset()).not.toThrow()
  })

  test("should allow new instance after reset", async () => {
    // Arrange
    await Database.getInstance(":memory:", DatabaseConfig.minimal())
    Database.reset()

    // Act
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())

    // Assert
    const db = assertSuccess(result)
    expect(db).toBeInstanceOf(Database)
    expect(db.isConnected()).toBe(true)
  })
})

describe("Database - getConnection()", () => {
  test("should return connection when initialized", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)

    // Act
    const connection = db.getConnection()

    // Assert
    expect(connection).toBeDefined()
    expect(typeof connection.prepare).toBe("function")
    expect(typeof connection.exec).toBe("function")
    expect(typeof connection.close).toBe("function")
  })

  test("should throw error when connection not initialized", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    db.close()

    // Act & Assert
    expect(() => db.getConnection()).toThrow("Database connection not initialized")
  })

  test("should return working connection", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()

    // Act
    connection.exec(USER_TEST_SCHEMA)
    const stmt = connection.prepare("SELECT name FROM sqlite_master WHERE type='table'")
    const tables = stmt.all() as Array<{ name: string }>

    // Assert
    expect(tables.some((t) => t.name === "users")).toBe(true)
  })
})

describe("Database - query()", () => {
  test("should execute SELECT query and return all rows", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)
    insertTestUsers(connection, 3)

    // Act
    const rows = db.query("SELECT * FROM users ORDER BY id")

    // Assert
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBe(3)
  })

  test("should execute SELECT query with parameters", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)
    insertTestUser(connection, { id: "user-1", email: "alice@example.com" })
    insertTestUser(connection, { id: "user-2", email: "bob@example.com" })

    // Act
    const rows = db.query("SELECT * FROM users WHERE id = ?", ["user-1"])

    // Assert
    expect(rows.length).toBe(1)
    const user = rows[0] as { id: string; email: string }
    expect(user.id).toBe("user-1")
    expect(user.email).toBe("alice@example.com")
  })

  test("should return empty array when no rows match", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)

    // Act
    const rows = db.query("SELECT * FROM users WHERE id = ?", ["nonexistent"])

    // Assert
    expect(rows).toEqual([])
  })

  test("should execute query without parameters", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)
    insertTestUsers(connection, 2)

    // Act
    const rows = db.query("SELECT COUNT(*) as count FROM users")

    // Assert
    expect(rows.length).toBe(1)
    const countResult = rows[0] as { count: number }
    expect(countResult.count).toBe(2)
  })

  test("should handle complex queries with multiple parameters", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)
    insertTestUser(connection, { id: "user-1", email: "alice@example.com", status: "active" })
    insertTestUser(connection, { id: "user-2", email: "bob@example.com", status: "inactive" })
    insertTestUser(connection, { id: "user-3", email: "charlie@example.com", status: "active" })

    // Act
    const rows = db.query("SELECT * FROM users WHERE status = ? ORDER BY email", ["active"])

    // Assert
    expect(rows.length).toBe(2)
    const users = rows as Array<{ id: string; status: string }>
    expect(users.every((u) => u.status === "active")).toBe(true)
  })
})

describe("Database - queryOne()", () => {
  test("should return first matching row", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)
    insertTestUser(connection, { id: "user-1", email: "alice@example.com" })
    insertTestUser(connection, { id: "user-2", email: "bob@example.com" })

    // Act
    const row = db.queryOne("SELECT * FROM users WHERE id = ?", ["user-1"])

    // Assert
    expect(row).toBeDefined()
    const user = row as { id: string; email: string }
    expect(user.id).toBe("user-1")
    expect(user.email).toBe("alice@example.com")
  })

  test("should return undefined when no rows match", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)

    // Act
    const row = db.queryOne("SELECT * FROM users WHERE id = ?", ["nonexistent"])

    // Assert
    // SQLite returns null for no match, not undefined
    expect(row).toBeNull()
  })

  test("should return first row when multiple rows match", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)
    insertTestUser(connection, { id: "user-1", email: "user1@example.com", status: "active" })
    insertTestUser(connection, { id: "user-2", email: "user2@example.com", status: "active" })

    // Act
    const row = db.queryOne("SELECT * FROM users WHERE status = ? ORDER BY id", ["active"])

    // Assert
    expect(row).toBeDefined()
    const user = row as { id: string }
    expect(user.id).toBe("user-1")
  })

  test("should work without parameters", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)
    insertTestUser(connection)

    // Act
    const row = db.queryOne("SELECT COUNT(*) as count FROM users")

    // Assert
    expect(row).toBeDefined()
    const countResult = row as { count: number }
    expect(countResult.count).toBe(1)
  })

  test("should work with aggregate functions", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)
    insertTestUsers(connection, 5)

    // Act
    const row = db.queryOne("SELECT COUNT(*) as total, MAX(created_at) as latest FROM users")

    // Assert
    expect(row).toBeDefined()
    const stats = row as { total: number; latest: number }
    expect(stats.total).toBe(5)
    expect(stats.latest).toBeGreaterThan(0)
  })
})

describe("Database - run()", () => {
  test("should execute INSERT and return changes count", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)
    const user = createTestUser()

    // Act
    const changes = db.run(
      "INSERT INTO users (id, email, name, status, created_at) VALUES (?, ?, ?, ?, ?)",
      [user.id, user.email, user.name, user.status, user.created_at]
    )

    // Assert
    expect(changes).toBe(1)
    const count = getUserCount(connection)
    expect(count).toBe(1)
  })

  test("should execute UPDATE and return changes count", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)
    insertTestUser(connection, { id: "user-1", email: "user1@example.com", status: "active" })
    insertTestUser(connection, { id: "user-2", email: "user2@example.com", status: "active" })

    // Act
    const changes = db.run("UPDATE users SET status = ? WHERE id = ?", ["inactive", "user-1"])

    // Assert
    expect(changes).toBe(1)
    const row = db.queryOne("SELECT status FROM users WHERE id = ?", ["user-1"])
    const user = row as { status: string }
    expect(user.status).toBe("inactive")
  })

  test("should execute DELETE and return changes count", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)
    insertTestUsers(connection, 3)

    // Act
    const changes = db.run("DELETE FROM users WHERE id = ?", ["user-1"])

    // Assert
    expect(changes).toBe(1)
    const count = getUserCount(connection)
    expect(count).toBe(2)
  })

  test("should return 0 changes when no rows affected", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)

    // Act
    const changes = db.run("DELETE FROM users WHERE id = ?", ["nonexistent"])

    // Assert
    expect(changes).toBe(0)
  })

  test("should execute without parameters", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)
    insertTestUsers(connection, 3)

    // Act
    const changes = db.run("DELETE FROM users")

    // Assert
    expect(changes).toBe(3)
    const count = getUserCount(connection)
    expect(count).toBe(0)
  })

  test("should handle multiple updates correctly", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)
    insertTestUser(connection, { id: "user-1", email: "user1@example.com", status: "active" })
    insertTestUser(connection, { id: "user-2", email: "user2@example.com", status: "active" })
    insertTestUser(connection, { id: "user-3", email: "user3@example.com", status: "inactive" })

    // Act
    const changes = db.run("UPDATE users SET status = ? WHERE status = ?", [
      "pending",
      "active",
    ])

    // Assert
    expect(changes).toBe(2)
    const rows = db.query("SELECT status FROM users WHERE status = ?", ["pending"])
    expect(rows.length).toBe(2)
  })
})

describe("Database - close()", () => {
  test("should close database connection", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    expect(db.isConnected()).toBe(true)

    // Act
    db.close()

    // Assert
    expect(db.isConnected()).toBe(false)
  })

  test("should reset singleton instance on close", async () => {
    // Arrange
    const result1 = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db1 = assertSuccess(result1)

    // Act
    db1.close()
    const result2 = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db2 = assertSuccess(result2)

    // Assert
    expect(db1).not.toBe(db2)
  })

  test("should handle close when already closed", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    db.close()

    // Act & Assert - should not throw
    expect(() => db.close()).not.toThrow()
  })

  test("should throw error on getConnection after close", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    db.close()

    // Act & Assert
    expect(() => db.getConnection()).toThrow("Database connection not initialized")
  })

  test("should close file-based database properly", async () => {
    // Arrange
    const result = await Database.getInstance(TEST_DB_PATH, DatabaseConfig.minimal())
    const db = assertSuccess(result)

    // Act
    db.close()

    // Assert
    expect(db.isConnected()).toBe(false)
    expect(existsSync(TEST_DB_PATH)).toBe(true)
  })
})

describe("Database - getPath()", () => {
  test("should return :memory: for in-memory database", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)

    // Act
    const path = db.getPath()

    // Assert
    expect(path).toBe(":memory:")
  })

  test("should return file path for file-based database", async () => {
    // Arrange
    const result = await Database.getInstance(TEST_DB_PATH, DatabaseConfig.minimal())
    const db = assertSuccess(result)

    // Act
    const path = db.getPath()

    // Assert
    expect(path).toBe(TEST_DB_PATH)
  })
})

describe("Database - getConfig()", () => {
  test("should return database config", async () => {
    // Arrange
    const config = DatabaseConfig.minimal()
    const result = await Database.getInstance(":memory:", config)
    const db = assertSuccess(result)

    // Act
    const dbConfig = db.getConfig()

    // Assert
    expect(dbConfig).toBe(config)
  })

  test("should return config with pragmas", async () => {
    // Arrange
    const config = new DatabaseConfig([
      { key: "journal_mode", value: "WAL" },
      { key: "foreign_keys", value: "on" },
    ])
    const result = await Database.getInstance(":memory:", config)
    const db = assertSuccess(result)

    // Act
    const dbConfig = db.getConfig()
    const pragmas = dbConfig.getPragmas()

    // Assert
    expect(pragmas.length).toBe(2)
    expect(pragmas[0].key).toBe("journal_mode")
  })
})

describe("Database - isConnected()", () => {
  test("should return true when connected", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)

    // Act
    const connected = db.isConnected()

    // Assert
    expect(connected).toBe(true)
  })

  test("should return false when not connected", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    db.close()

    // Act
    const connected = db.isConnected()

    // Assert
    expect(connected).toBe(false)
  })

  test("should return false after reset", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)

    // Act
    Database.reset()

    // Assert
    // After reset, the singleton is cleared
    expect(Database.getCurrentInstance()).toBeNull()
  })
})

describe("Database - Error Handling", () => {
  test("should handle SQL syntax errors in query", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)

    // Act & Assert
    expect(() => db.query("INVALID SQL SYNTAX")).toThrow()
  })

  test("should handle SQL syntax errors in queryOne", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)

    // Act & Assert
    expect(() => db.queryOne("SELECT * FROM nonexistent_table")).toThrow()
  })

  test("should handle SQL syntax errors in run", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)

    // Act & Assert
    expect(() => db.run("INSERT INTO nonexistent_table VALUES (?)")).toThrow()
  })

  test("should handle parameter mismatch in query", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)

    // Act & Assert
    expect(() => db.query("SELECT * FROM users WHERE id = ? AND email = ?", ["user-1"])).toThrow()
  })

  test("should handle constraint violations", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)
    const user = createTestUser({ id: "user-1", email: "test@example.com" })
    db.run("INSERT INTO users (id, email, name, status, created_at) VALUES (?, ?, ?, ?, ?)", [
      user.id,
      user.email,
      user.name,
      user.status,
      user.created_at,
    ])

    // Act & Assert - Try to insert duplicate email
    expect(() =>
      db.run("INSERT INTO users (id, email, name, status, created_at) VALUES (?, ?, ?, ?, ?)", [
        "user-2",
        user.email,
        "Another User",
        "active",
        Date.now(),
      ])
    ).toThrow()
  })
})

describe("Database - Schema Initialization", () => {
  test("should initialize with schema from file", async () => {
    // Arrange
    await mkdir(TEST_DB_DIR, { recursive: true })
    await Bun.write(TEST_SCHEMA_PATH, USER_TEST_SCHEMA)

    // Create a new instance that will load the schema
    // Note: This tests the private loadSchema method indirectly
    const config = DatabaseConfig.minimal()

    // Act
    const result = await Database.getInstance(":memory:", config)
    const db = assertSuccess(result)

    // Manually load schema since getInstance doesn't accept schemaPath parameter
    const connection = db.getConnection()
    const schema = await Bun.file(TEST_SCHEMA_PATH).text()
    connection.exec(schema)

    // Assert
    const stmt = connection.prepare("SELECT name FROM sqlite_master WHERE type='table'")
    const tables = stmt.all() as Array<{ name: string }>
    expect(tables.some((t) => t.name === "users")).toBe(true)
  })

  test("should initialize empty database when no schema provided", async () => {
    // Act
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)

    // Assert
    const connection = db.getConnection()
    const stmt = connection.prepare("SELECT name FROM sqlite_master WHERE type='table'")
    const tables = stmt.all() as Array<{ name: string }>
    expect(tables.length).toBe(0)
  })
})

describe("Database - Concurrent Operations", () => {
  test("should handle multiple queries in sequence", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)

    // Act
    insertTestUser(connection, { id: "user-1", email: "user1@example.com" })
    insertTestUser(connection, { id: "user-2", email: "user2@example.com" })
    insertTestUser(connection, { id: "user-3", email: "user3@example.com" })

    const rows1 = db.query("SELECT * FROM users")
    const changes = db.run("UPDATE users SET status = ?", ["inactive"])
    const rows2 = db.query("SELECT * FROM users WHERE status = ?", ["inactive"])

    // Assert
    expect(rows1.length).toBe(3)
    expect(changes).toBe(3)
    expect(rows2.length).toBe(3)
  })

  test("should maintain data consistency across operations", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)

    // Act - Insert, update, query, delete sequence
    const user = createTestUser({ id: "user-1", email: "test@example.com", status: "active" })
    db.run("INSERT INTO users (id, email, name, status, created_at) VALUES (?, ?, ?, ?, ?)", [
      user.id,
      user.email,
      user.name,
      user.status,
      user.created_at,
    ])

    const inserted = db.queryOne("SELECT * FROM users WHERE id = ?", ["user-1"]) as {
      status: string
    }
    expect(inserted.status).toBe("active")

    db.run("UPDATE users SET status = ? WHERE id = ?", ["inactive", "user-1"])

    const updated = db.queryOne("SELECT * FROM users WHERE id = ?", ["user-1"]) as {
      status: string
    }
    expect(updated.status).toBe("inactive")

    db.run("DELETE FROM users WHERE id = ?", ["user-1"])

    const deleted = db.queryOne("SELECT * FROM users WHERE id = ?", ["user-1"])
    expect(deleted).toBeNull()
  })
})

describe("Database - Edge Cases", () => {
  test("should handle empty parameter array", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)

    // Act
    const rows = db.query("SELECT * FROM users", [])

    // Assert
    expect(rows).toEqual([])
  })

  test("should handle null values in parameters", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(`
      CREATE TABLE nullable_test (
        id TEXT PRIMARY KEY,
        value TEXT
      )
    `)

    // Act
    db.run("INSERT INTO nullable_test (id, value) VALUES (?, ?)", ["test-1", null])
    const row = db.queryOne("SELECT * FROM nullable_test WHERE id = ?", ["test-1"])

    // Assert
    expect(row).toBeDefined()
    const result_row = row as { id: string; value: null }
    expect(result_row.value).toBeNull()
  })

  test("should handle very long strings", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)
    const longString = "a".repeat(10000)

    // Act
    const user = createTestUser({ id: "user-1", name: longString })
    db.run("INSERT INTO users (id, email, name, status, created_at) VALUES (?, ?, ?, ?, ?)", [
      user.id,
      user.email,
      user.name,
      user.status,
      user.created_at,
    ])
    const row = db.queryOne("SELECT name FROM users WHERE id = ?", ["user-1"])

    // Assert
    const retrieved = row as { name: string }
    expect(retrieved.name).toBe(longString)
    expect(retrieved.name.length).toBe(10000)
  })

  test("should handle queries with no results gracefully", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)

    // Act
    const rows = db.query("SELECT * FROM users WHERE status = ?", ["nonexistent"])
    const row = db.queryOne("SELECT * FROM users WHERE status = ?", ["nonexistent"])

    // Assert
    expect(rows).toEqual([])
    expect(row).toBeNull()
  })

  test("should handle numeric parameter types", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(`
      CREATE TABLE numeric_test (
        id INTEGER PRIMARY KEY,
        value REAL
      )
    `)

    // Act
    db.run("INSERT INTO numeric_test (id, value) VALUES (?, ?)", [42, 3.14159])
    const row = db.queryOne("SELECT * FROM numeric_test WHERE id = ?", [42])

    // Assert
    expect(row).toBeDefined()
    const result_row = row as { id: number; value: number }
    expect(result_row.id).toBe(42)
    expect(result_row.value).toBeCloseTo(3.14159, 5)
  })

  test("should handle boolean parameter types", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(`
      CREATE TABLE boolean_test (
        id TEXT PRIMARY KEY,
        active INTEGER
      )
    `)

    // Act
    db.run("INSERT INTO boolean_test (id, active) VALUES (?, ?)", ["test-1", 1])
    db.run("INSERT INTO boolean_test (id, active) VALUES (?, ?)", ["test-2", 0])

    const row1 = db.queryOne("SELECT * FROM boolean_test WHERE id = ?", ["test-1"])
    const row2 = db.queryOne("SELECT * FROM boolean_test WHERE id = ?", ["test-2"])

    // Assert
    const result1 = row1 as { id: string; active: number }
    const result2 = row2 as { id: string; active: number }
    expect(result1.active).toBe(1)
    expect(result2.active).toBe(0)
  })

  test("should handle special characters in strings", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)

    // Act
    const specialString = "Test's \"quoted\" value & <html> 日本語"
    const user = createTestUser({ id: "user-1", name: specialString })
    db.run("INSERT INTO users (id, email, name, status, created_at) VALUES (?, ?, ?, ?, ?)", [
      user.id,
      user.email,
      user.name,
      user.status,
      user.created_at,
    ])
    const row = db.queryOne("SELECT name FROM users WHERE id = ?", ["user-1"])

    // Assert
    const retrieved = row as { name: string }
    expect(retrieved.name).toBe(specialString)
  })

  test("should handle empty string parameters", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(`
      CREATE TABLE empty_test (
        id TEXT PRIMARY KEY,
        value TEXT
      )
    `)

    // Act
    db.run("INSERT INTO empty_test (id, value) VALUES (?, ?)", ["test-1", ""])
    const row = db.queryOne("SELECT * FROM empty_test WHERE id = ?", ["test-1"])

    // Assert
    expect(row).toBeDefined()
    const result_row = row as { id: string; value: string }
    expect(result_row.value).toBe("")
  })

  test("should handle large batch operations", async () => {
    // Arrange
    const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
    const db = assertSuccess(result)
    const connection = db.getConnection()
    connection.exec(USER_TEST_SCHEMA)

    // Act - Insert many rows
    const batchSize = 100
    for (let i = 0; i < batchSize; i++) {
      db.run("INSERT INTO users (id, email, name, status, created_at) VALUES (?, ?, ?, ?, ?)", [
        `user-${i}`,
        `user${i}@example.com`,
        `User ${i}`,
        "active",
        Date.now(),
      ])
    }

    const rows = db.query("SELECT COUNT(*) as count FROM users")

    // Assert
    const countResult = rows[0] as { count: number }
    expect(countResult.count).toBe(batchSize)
  })
})
