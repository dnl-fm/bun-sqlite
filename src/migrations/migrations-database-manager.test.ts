/**
 * Tests for MigrationsDatabaseManager
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { MigrationsDatabaseManager } from "./migrations-database-manager.ts"
import { unlinkSync, existsSync } from "node:fs"
import { rm } from "node:fs/promises"

const TEST_DB_PATH = "./test-migrations.db"
const TEST_DB_WAL_PATH = "./test-migrations.db-wal"
const TEST_DB_SHM_PATH = "./test-migrations.db-shm"

/**
 * Clean up test database files
 */
function cleanupTestDb(): void {
  [TEST_DB_PATH, TEST_DB_WAL_PATH, TEST_DB_SHM_PATH].forEach(path => {
    if (existsSync(path)) {
      unlinkSync(path)
    }
  })
}

describe("MigrationsDatabaseManager", () => {
  beforeEach(() => {
    cleanupTestDb()
  })

  afterEach(() => {
    cleanupTestDb()
  })

  describe("initialize", () => {
    test("should create database file if it doesn't exist", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)

      // Act
      const result = await manager.initialize()

      // Assert
      expect(result.isError).toBe(false)
      expect(existsSync(TEST_DB_PATH)).toBe(true)

      manager.close()
    })

    test("should create _migrations_applied table", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)
      await manager.initialize()

      // Act
      const recordResult = await manager.recordApplied("20251022T143045", "test_migration")

      // Assert
      expect(recordResult.isError).toBe(false)

      manager.close()
    })

    test("should handle existing database file", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)
      await manager.initialize()
      manager.close()

      // Act - Initialize again
      const manager2 = new MigrationsDatabaseManager(TEST_DB_PATH)
      const result = await manager2.initialize()

      // Assert
      expect(result.isError).toBe(false)

      manager2.close()
    })

    test("should create parent directories if needed", async () => {
      // Arrange
      const testPath = "./temp-migrations/subdir/.migrations.db"
      const manager = new MigrationsDatabaseManager(testPath)

      // Act
      const result = await manager.initialize()

      // Assert
      expect(result.isError).toBe(false)
      expect(existsSync(testPath)).toBe(true)

      manager.close()
      await rm("./temp-migrations", { recursive: true, force: true })
    })
  })

  describe("recordApplied", () => {
    test("should record a migration as applied", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)
      await manager.initialize()

      // Act
      const result = await manager.recordApplied("20251022T143045", "create_users")

      // Assert
      expect(result.isError).toBe(false)

      manager.close()
    })

    test("should return error if not initialized", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)

      // Act
      const result = await manager.recordApplied("20251022T143045", "test")

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("not initialized")
      }
    })

    test("should record multiple migrations", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)
      await manager.initialize()

      // Act
      const result1 = await manager.recordApplied("20251022T143045", "create_users")
      const result2 = await manager.recordApplied("20251022T143046", "add_posts")
      const result3 = await manager.recordApplied("20251022T143047", "add_comments")

      // Assert
      expect(result1.isError).toBe(false)
      expect(result2.isError).toBe(false)
      expect(result3.isError).toBe(false)

      const appliedResult = await manager.getApplied()
      expect(appliedResult.isError).toBe(false)
      if (!appliedResult.isError) {
        expect(appliedResult.value.length).toBe(3)
      }

      manager.close()
    })

    test("should accept empty description", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)
      await manager.initialize()

      // Act
      const result = await manager.recordApplied("20251022T143045", "")

      // Assert
      expect(result.isError).toBe(false)

      manager.close()
    })
  })

  describe("getApplied", () => {
    test("should return empty array when no migrations applied", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)
      await manager.initialize()

      // Act
      const result = await manager.getApplied()

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.length).toBe(0)
      }

      manager.close()
    })

    test("should return all applied migration versions", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)
      await manager.initialize()
      await manager.recordApplied("20251022T143045", "test1")
      await manager.recordApplied("20251022T143046", "test2")

      // Act
      const result = await manager.getApplied()

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.length).toBe(2)
        expect(result.value).toContain("20251022T143045")
        expect(result.value).toContain("20251022T143046")
      }

      manager.close()
    })

    test("should return error if not initialized", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)

      // Act
      const result = await manager.getApplied()

      // Assert
      expect(result.isError).toBe(true)
    })

    test("should return versions in chronological order", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)
      await manager.initialize()

      // Record migrations out of order
      await manager.recordApplied("20251022T143047", "test3")
      await manager.recordApplied("20251022T143045", "test1")
      await manager.recordApplied("20251022T143046", "test2")

      // Act
      const result = await manager.getApplied()

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value[0]).toBe("20251022T143047")
        expect(result.value[1]).toBe("20251022T143045")
        expect(result.value[2]).toBe("20251022T143046")
      }

      manager.close()
    })
  })

  describe("getStatus", () => {
    test("should show no applied, all pending", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)
      await manager.initialize()
      const allVersions = ["20251022T143045", "20251022T143046", "20251022T143047"]

      // Act
      const result = await manager.getStatus(allVersions)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.applied.length).toBe(0)
        expect(result.value.pending.length).toBe(3)
        expect(result.value.pending).toEqual(allVersions)
      }

      manager.close()
    })

    test("should show applied and pending migrations", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)
      await manager.initialize()
      await manager.recordApplied("20251022T143045", "test1")

      const allVersions = ["20251022T143045", "20251022T143046", "20251022T143047"]

      // Act
      const result = await manager.getStatus(allVersions)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.applied.length).toBe(1)
        expect(result.value.pending.length).toBe(2)
        expect(result.value.applied).toContain("20251022T143045")
        expect(result.value.pending).toContain("20251022T143046")
        expect(result.value.pending).toContain("20251022T143047")
      }

      manager.close()
    })

    test("should show all applied, no pending", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)
      await manager.initialize()
      const versions = ["20251022T143045", "20251022T143046"]
      for (const version of versions) {
        await manager.recordApplied(version, "test")
      }

      // Act
      const result = await manager.getStatus(versions)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.applied.length).toBe(2)
        expect(result.value.pending.length).toBe(0)
      }

      manager.close()
    })

    test("should handle empty allVersions", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)
      await manager.initialize()

      // Act
      const result = await manager.getStatus([])

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.applied.length).toBe(0)
        expect(result.value.pending.length).toBe(0)
      }

      manager.close()
    })
  })

  describe("close", () => {
    test("should close connection without error", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)
      await manager.initialize()

      // Act & Assert - should not throw
      expect(() => {
        manager.close()
      }).not.toThrow()
    })

    test("should allow re-initialization after close", async () => {
      // Arrange
      const manager = new MigrationsDatabaseManager(TEST_DB_PATH)
      await manager.initialize()
      await manager.recordApplied("20251022T143045", "test1")
      manager.close()

      // Act
      const result = await manager.initialize()
      const appliedResult = await manager.getApplied()

      // Assert
      expect(result.isError).toBe(false)
      expect(appliedResult.isError).toBe(false)
      if (!appliedResult.isError) {
        expect(appliedResult.value.length).toBe(1)
      }

      manager.close()
    })
  })
})
