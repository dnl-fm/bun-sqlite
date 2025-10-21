/**
 * MigrationRunner test suite
 * Tests migration execution and tracking with the new record-based API
 */

import { describe, it, expect } from "bun:test"
import { MigrationRunner, type MigrationModule } from "../../src/migrations/migration-runner.ts"
import type { DatabaseConnection } from "../../src/types.ts"
import { Database } from "../../src/core/database.ts"
import { DatabaseConfig } from "../../src/core/database-config.ts"

describe("MigrationRunner", () => {
  describe("basic operations", () => {
    it("should initialize migration tracking table", async () => {
      const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
      expect(result.isError).toBe(false)
      if (result.isError) return

      const db = result.value
      const connection = db.getConnection()

      const migrations: Record<string, MigrationModule> = {}
      const runner = new MigrationRunner(connection, migrations)

      const initResult = await runner.initialize()

      expect(initResult.isError).toBe(false)

      // Verify table exists
      const tables = connection.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'`
      ).all()
      expect(tables.length).toBe(1)

      db.close()
    })

    it("should run a single migration", async () => {
      const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
      expect(result.isError).toBe(false)
      if (result.isError) return

      const db = result.value
      const connection = db.getConnection()

      const migrations: Record<string, MigrationModule> = {
        "20251020000000_create_table": {
          up: (db: DatabaseConnection) => {
            db.exec("CREATE TABLE test_table (id INTEGER PRIMARY KEY)")
          },
        },
      }

      const runner = new MigrationRunner(connection, migrations)
      const migrateResult = await runner.migrate()

      expect(migrateResult.isError).toBe(false)
      expect(migrateResult.value).toBe(1)

      // Verify table was created
      const tables = connection.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'`
      ).all()
      expect(tables.length).toBe(1)

      db.close()
    })

    it("should not run already applied migrations", async () => {
      const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
      expect(result.isError).toBe(false)
      if (result.isError) return

      const db = result.value
      const connection = db.getConnection()

      const migrations: Record<string, MigrationModule> = {
        "20251020000000_create_table": {
          up: (db: DatabaseConnection) => {
            db.exec("CREATE TABLE test_table (id INTEGER PRIMARY KEY)")
          },
        },
      }

      const runner = new MigrationRunner(connection, migrations)

      // Run once
      const result1 = await runner.migrate()
      expect(result1.isError).toBe(false)
      expect(result1.value).toBe(1)

      // Run again - should not rerun
      const result2 = await runner.migrate()
      expect(result2.isError).toBe(false)
      expect(result2.value).toBe(0)

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
        "20251020000002_third": {
          up: () => {
            executionOrder.push("third")
          },
        },
        "20251020000001_second": {
          up: () => {
            executionOrder.push("second")
          },
        },
        "20251020000000_first": {
          up: () => {
            executionOrder.push("first")
          },
        },
      }

      const runner = new MigrationRunner(connection, migrations)
      const migrateResult = await runner.migrate()

      expect(migrateResult.isError).toBe(false)
      expect(executionOrder).toEqual(["first", "second", "third"])

      db.close()
    })

    it("should handle async migrations", async () => {
      const result = await Database.getInstance(":memory:", DatabaseConfig.minimal())
      expect(result.isError).toBe(false)
      if (result.isError) return

      const db = result.value
      const connection = db.getConnection()

      const migrations: Record<string, MigrationModule> = {
        "20251020000000_async_migration": {
          up: async (db: DatabaseConnection) => {
            // Simulate async work
            await new Promise((resolve) => setTimeout(resolve, 10))
            db.exec("CREATE TABLE async_table (id INTEGER PRIMARY KEY)")
          },
        },
      }

      const runner = new MigrationRunner(connection, migrations)
      const migrateResult = await runner.migrate()

      expect(migrateResult.isError).toBe(false)

      const tables = connection.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='async_table'`
      ).all()
      expect(tables.length).toBe(1)

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
        "20251020000000_create_users": {
          up: (db: DatabaseConnection) => {
            db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
          },
        },
        "20251020000001_create_posts": {
          up: (db: DatabaseConnection) => {
            db.exec(
              "CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER, content TEXT)"
            )
          },
        },
      }

      const runner = new MigrationRunner(connection, migrations)
      const migrateResult = await runner.migrate()

      expect(migrateResult.isError).toBe(false)
      expect(migrateResult.value).toBe(2)

      // Verify both tables exist
      const users = connection.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='users'`
      ).all()
      const posts = connection.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='posts'`
      ).all()

      expect(users.length).toBe(1)
      expect(posts.length).toBe(1)

      db.close()
    })
  })
})
