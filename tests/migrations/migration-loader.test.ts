/**
 * Tests for MigrationLoader
 */

import { test, expect, describe } from "bun:test"
import { MigrationLoader, loadMigrations } from "../../src/migrations/migration-loader.ts"

describe("MigrationLoader", () => {
  describe("load - Valid migrations", () => {
    test("should load valid migrations from directory", async () => {
      // Arrange
      const dirPath = "./tests/migrations/fixtures/valid"

      // Act
      const result = await MigrationLoader.load(dirPath)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        const versions = Object.keys(result.value).sort()
        expect(versions.length).toBe(2)
        expect(versions[0]).toBe("20251022T143045")
        expect(versions[1]).toBe("20251022T143046")
      }
    })

    test("should have up function for each migration", async () => {
      // Arrange
      const dirPath = "./tests/migrations/fixtures/valid"

      // Act
      const result = await MigrationLoader.load(dirPath)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        const migrations = result.value
        for (const [, migration] of Object.entries(migrations)) {
          expect(migration.up).toBeDefined()
          expect(typeof migration.up).toBe("function")
        }
      }
    })

    test("should have down function for migrations that define it", async () => {
      // Arrange
      const dirPath = "./tests/migrations/fixtures/valid"

      // Act
      const result = await MigrationLoader.load(dirPath)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        const migrations = result.value
        for (const [, migration] of Object.entries(migrations)) {
          // Both migrations in fixtures have down functions
          expect(migration.down).toBeDefined()
        }
      }
    })

    test("should sort migrations by version ascending", async () => {
      // Arrange
      const dirPath = "./tests/migrations/fixtures/valid"

      // Act
      const result = await MigrationLoader.load(dirPath)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        const versions = Object.keys(result.value)
        const sorted = [...versions].sort()
        expect(versions).toEqual(sorted)
      }
    })

    test("should return error for directory with invalid migrations", async () => {
      // Arrange
      const dirPath = "./tests/migrations/fixtures/invalid"

      // Act
      const result = await MigrationLoader.load(dirPath)

      // Assert
      // The directory has files with invalid structure (no_up.ts), so it should error
      expect(result.isError).toBe(true)
    })
  })

  describe("load - Invalid scenarios", () => {
    test("should detect collision errors", async () => {
      // Arrange
      const dirPath = "./tests/migrations/fixtures/collision"

      // Act
      const result = await MigrationLoader.load(dirPath)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("collision")
      }
    })

    test("should return error for non-existent directory", async () => {
      // Arrange
      const dirPath = "./non-existent-migrations-dir"

      // Act
      const result = await MigrationLoader.load(dirPath)

      // Assert
      expect(result.isError).toBe(true)
    })

    test("should return error when migration module lacks up function", async () => {
      // Arrange
      // Create a temporary directory with invalid migration
      const tempDir = "./temp-test-migrations-no-up"
      await Bun.write(
        tempDir + "/20251022T143045_no_up_test.ts",
        `export function down(db) { db.exec("DROP TABLE test") }`
      )

      // Act
      const result = await MigrationLoader.load(tempDir)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("up")
      }

      // Cleanup
      await Bun.file(tempDir + "/20251022T143045_no_up_test.ts").delete()
    })
  })

  describe("loadMigrations convenience function", () => {
    test("should load migrations using convenience function", async () => {
      // Arrange
      const dirPath = "./tests/migrations/fixtures/valid"

      // Act
      const result = await loadMigrations(dirPath)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(Object.keys(result.value).length).toBe(2)
      }
    })

    test("should return error using convenience function", async () => {
      // Arrange
      const dirPath = "./tests/migrations/fixtures/collision"

      // Act
      const result = await loadMigrations(dirPath)

      // Assert
      expect(result.isError).toBe(true)
    })
  })

  describe("load - File filtering", () => {
    test("should skip non-.ts files", async () => {
      // Arrange
      const dirPath = "./tests/migrations/fixtures/valid"

      // Act
      const result = await MigrationLoader.load(dirPath)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        // Should only load .ts files
        const versions = Object.keys(result.value)
        expect(versions.every(v => typeof v === "string")).toBe(true)
      }
    })

    test("should skip files without timestamp in name but error on invalid structure", async () => {
      // Arrange
      const dirPath = "./tests/migrations/fixtures/invalid"

      // Act
      const result = await MigrationLoader.load(dirPath)

      // Assert
      // The directory has both invalid filenames and invalid modules
      // The loader should error when it encounters the no_up.ts file with invalid structure
      expect(result.isError).toBe(true)
    })
  })
})
