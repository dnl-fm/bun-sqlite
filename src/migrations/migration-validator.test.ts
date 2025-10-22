/**
 * Tests for MigrationValidator
 */

import { test, expect, describe } from "bun:test"
import { MigrationValidator } from "./migration-validator.ts"

describe("MigrationValidator", () => {
  describe("validate - Valid modules", () => {
    test("should accept module with up function only", () => {
      // Arrange
      const module = {
        up: (db: any) => {
          db.exec("CREATE TABLE users (id TEXT PRIMARY KEY)")
        },
      }

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.up).toBeDefined()
        expect(typeof result.value.up).toBe("function")
      }
    })

    test("should accept module with async up function", () => {
      // Arrange
      const module = {
        up: async (db: any) => {
          await Promise.resolve()
        },
      }

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.up).toBeDefined()
      }
    })

    test("should accept module with up and down functions", () => {
      // Arrange
      const module = {
        up: (db: any) => {
          db.exec("CREATE TABLE users (id TEXT PRIMARY KEY)")
        },
        down: (db: any) => {
          db.exec("DROP TABLE users")
        },
      }

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.up).toBeDefined()
        expect(result.value.down).toBeDefined()
        expect(typeof result.value.down).toBe("function")
      }
    })

    test("should accept module with async down function", () => {
      // Arrange
      const module = {
        up: (db: any) => {},
        down: async (db: any) => {
          await Promise.resolve()
        },
      }

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.down).toBeDefined()
      }
    })

    test("should accept module with extra properties", () => {
      // Arrange
      const module = {
        up: (db: any) => {},
        down: (db: any) => {},
        description: "This is a migration",
        version: "20251022T143045",
      }

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.up).toBeDefined()
        expect(result.value.down).toBeDefined()
      }
    })

    test("should accept module with null down function", () => {
      // Arrange
      const module = {
        up: (db: any) => {},
        down: null,
      }

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.up).toBeDefined()
        expect(result.value.down).toBeUndefined()
      }
    })

    test("should accept module with undefined down function", () => {
      // Arrange
      const module = {
        up: (db: any) => {},
        down: undefined,
      }

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(false)
    })
  })

  describe("validate - Invalid modules", () => {
    test("should reject null module", () => {
      // Arrange
      const module = null

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("must be a valid JavaScript object")
      }
    })

    test("should reject undefined module", () => {
      // Arrange
      const module = undefined

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("must be a valid JavaScript object")
      }
    })

    test("should reject string instead of object", () => {
      // Arrange
      const module = "not an object"

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(true)
    })

    test("should reject number instead of object", () => {
      // Arrange
      const module = 123

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(true)
    })

    test("should reject module without up function", () => {
      // Arrange
      const module = {
        down: (db: any) => {},
      }

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("must export an 'up' function")
      }
    })

    test("should reject module with non-function up", () => {
      // Arrange
      const module = {
        up: "not a function",
      }

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("'up' must be a function")
      }
    })

    test("should reject module with number up", () => {
      // Arrange
      const module = {
        up: 42,
      }

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("'up' must be a function")
      }
    })

    test("should reject module with non-function down", () => {
      // Arrange
      const module = {
        up: (db: any) => {},
        down: "not a function",
      }

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("'down' must be a function")
      }
    })

    test("should reject module with number down", () => {
      // Arrange
      const module = {
        up: (db: any) => {},
        down: 123,
      }

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("'down' must be a function")
      }
    })

    test("should reject module with object down", () => {
      // Arrange
      const module = {
        up: (db: any) => {},
        down: { some: "object" },
      }

      // Act
      const result = MigrationValidator.validate(module)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("'down' must be a function")
      }
    })
  })
})
