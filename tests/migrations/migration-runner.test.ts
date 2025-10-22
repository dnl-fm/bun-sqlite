/**
 * MigrationRunner test suite
 * Tests migration execution and tracking with migrations.db
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { MigrationRunner, type MigrationModule } from "../../src/migrations/migration-runner.ts"
import type { DatabaseConnection } from "../../src/types.ts"
import { Database } from "../../src/core/database.ts"
import { DatabaseConfig } from "../../src/core/database-config.ts"
import { unlinkSync, existsSync } from "node:fs"

const TEST_MIGRATIONS_DB = "./test-mr.db"
const TEST_MIGRATIONS_DB_WAL = "./test-mr.db-wal"
const TEST_MIGRATIONS_DB_SHM = "./test-mr.db-shm"

/**
 * Clean up test database files
 */
function cleanupTestDb(): void {
  [TEST_MIGRATIONS_DB, TEST_MIGRATIONS_DB_WAL, TEST_MIGRATIONS_DB_SHM].forEach(path => {
    if (existsSync(path)) {
      unlinkSync(path)
    }
  })
}

describe("MigrationRunner", () => {
  beforeEach(() => {
    cleanupTestDb()
  })

  afterEach(() => {
    cleanupTestDb()
  })

  describe("basic operations", () => {
    it("should initialize migration tracking database", async () => {
      const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
      expect(result.isError).toBe(false)
      if (result.isError) return

      const db = result.value
      const connection = db.getConnection()

      const migrations: Record<string, MigrationModule> = {}
      const runner = new MigrationRunner(connection, migrations, { migrationsDbPath: TEST_MIGRATIONS_DB })

      const initResult = await runner.initialize()

      expect(initResult.isError).toBe(false)
      expect(existsSync(TEST_MIGRATIONS_DB)).toBe(true)

      runner.close()
      db.close()
    })

    it("should run a single migration", async () => {
      const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
      expect(result.isError).toBe(false)
      if (result.isError) return

      const db = result.value
      const connection = db.getConnection()

      const migrations: Record<string, MigrationModule> = {
        "20251020000000": {
          up: (db: DatabaseConnection) => {
            db.exec("CREATE TABLE test_table (id INTEGER PRIMARY KEY)")
          },
        },
      }

      const runner = new MigrationRunner(connection, migrations, { migrationsDbPath: TEST_MIGRATIONS_DB })
      const migrateResult = await runner.migrate()

      expect(migrateResult.isError).toBe(false)
      if (!migrateResult.isError) {
        expect(migrateResult.value).toBe(1)
      }

      // Verify table was created
      const tables = connection.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'`
      ).all()
      expect(tables.length).toBe(1)

      runner.close()
      db.close()
    })

    it("should not run already applied migrations", async () => {
      const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
      expect(result.isError).toBe(false)
      if (result.isError) return

      const db = result.value
      const connection = db.getConnection()

      const migrations: Record<string, MigrationModule> = {
        "20251020000000": {
          up: (db: DatabaseConnection) => {
            db.exec("CREATE TABLE test_table (id INTEGER PRIMARY KEY)")
          },
        },
      }

      const runner = new MigrationRunner(connection, migrations, { migrationsDbPath: TEST_MIGRATIONS_DB })

      // Run once
      const result1 = await runner.migrate()
      expect(result1.isError).toBe(false)
      if (!result1.isError) {
        expect(result1.value).toBe(1)
      }

      // Run again - should not rerun
      const result2 = await runner.migrate()
      expect(result2.isError).toBe(false)
      if (!result2.isError) {
        expect(result2.value).toBe(0)
      }

      runner.close()
      db.close()
    })

    it("should run migrations in sorted order", async () => {
      const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
      expect(result.isError).toBe(false)
      if (result.isError) return

      const db = result.value
      const connection = db.getConnection()

      const executionOrder: string[] = []

      const migrations: Record<string, MigrationModule> = {
        "20251020000002": {
          up: () => {
            executionOrder.push("third")
          },
        },
        "20251020000001": {
          up: () => {
            executionOrder.push("second")
          },
        },
        "20251020000000": {
          up: () => {
            executionOrder.push("first")
          },
        },
      }

      const runner = new MigrationRunner(connection, migrations, { migrationsDbPath: TEST_MIGRATIONS_DB })
      const migrateResult = await runner.migrate()

      expect(migrateResult.isError).toBe(false)
      expect(executionOrder).toEqual(["first", "second", "third"])

      runner.close()
      db.close()
    })

    it("should handle async migrations", async () => {
      const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
      expect(result.isError).toBe(false)
      if (result.isError) return

      const db = result.value
      const connection = db.getConnection()

      const migrations: Record<string, MigrationModule> = {
        "20251020000000": {
          up: async (db: DatabaseConnection) => {
            // Simulate async work
            await new Promise((resolve) => setTimeout(resolve, 10))
            db.exec("CREATE TABLE async_table (id INTEGER PRIMARY KEY)")
          },
        },
      }

      const runner = new MigrationRunner(connection, migrations, { migrationsDbPath: TEST_MIGRATIONS_DB })
      const migrateResult = await runner.migrate()

      expect(migrateResult.isError).toBe(false)

      const tables = connection.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='async_table'`
      ).all()
      expect(tables.length).toBe(1)

      runner.close()
      db.close()
    })
  })

  describe("multiple migrations", () => {
    it("should run multiple migrations in sequence", async () => {
      const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
      expect(result.isError).toBe(false)
      if (result.isError) return

      const db = result.value
      const connection = db.getConnection()

      const migrations: Record<string, MigrationModule> = {
        "20251020000000": {
          up: (db: DatabaseConnection) => {
            db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
          },
        },
        "20251020000001": {
          up: (db: DatabaseConnection) => {
            db.exec(
              "CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER, content TEXT)"
            )
          },
        },
      }

      const runner = new MigrationRunner(connection, migrations, { migrationsDbPath: TEST_MIGRATIONS_DB })
      const migrateResult = await runner.migrate()

      expect(migrateResult.isError).toBe(false)
      if (!migrateResult.isError) {
        expect(migrateResult.value).toBe(2)
      }

      // Verify both tables exist
      const users = connection.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='users'`
      ).all()
      const posts = connection.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='posts'`
      ).all()

      expect(users.length).toBe(1)
      expect(posts.length).toBe(1)

      runner.close()
      db.close()
    })
  })
})
