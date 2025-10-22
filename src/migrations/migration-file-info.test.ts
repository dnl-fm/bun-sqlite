/**
 * Tests for MigrationFileInfo value object
 */

import { test, expect, describe } from "bun:test"
import { MigrationFileInfo } from "./migration-file-info.ts"

describe("MigrationFileInfo", () => {
  describe("fromFileName - Valid filenames", () => {
    test("should parse valid migration filename with underscore description", () => {
      // Arrange
      const fileName = "20251022T143045_create_users.ts"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.getVersion()).toBe("20251022T143045")
        expect(result.value.getDescription()).toBe("create_users")
        expect(result.value.getFileName()).toBe(fileName)
        expect(result.value.getFilePath()).toBe("./migrations/20251022T143045_create_users.ts")
      }
    })

    test("should parse valid migration filename with numbers in description", () => {
      // Arrange
      const fileName = "20251022T091500_add_posts_v2.ts"
      const dirPath = "/app/migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.getVersion()).toBe("20251022T091500")
        expect(result.value.getDescription()).toBe("add_posts_v2")
      }
    })

    test("should handle directory path with trailing slash", () => {
      // Arrange
      const fileName = "20251022T143045_init_db.ts"
      const dirPath = "./migrations/"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.getFilePath()).toBe("./migrations/20251022T143045_init_db.ts")
      }
    })

    test("should handle absolute directory path", () => {
      // Arrange
      const fileName = "20251022T143045_test.ts"
      const dirPath = "/home/user/project/migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.getFilePath()).toBe("/home/user/project/migrations/20251022T143045_test.ts")
      }
    })

    test("should parse timestamp at beginning of year", () => {
      // Arrange
      const fileName = "20250101T000000_new_year.ts"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.getVersion()).toBe("20250101T000000")
      }
    })

    test("should parse timestamp at end of year", () => {
      // Arrange
      const fileName = "20251231T235959_year_end.ts"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(false)
      if (!result.isError) {
        expect(result.value.getVersion()).toBe("20251231T235959")
      }
    })
  })

  describe("fromFileName - Invalid filenames", () => {
    test("should reject filename without .ts extension", () => {
      // Arrange
      const fileName = "20251022T143045_create_users.js"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Invalid migration filename")
      }
    })

    test("should reject filename without timestamp", () => {
      // Arrange
      const fileName = "create_users.ts"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Invalid migration filename")
      }
    })

    test("should reject filename without underscore separator", () => {
      // Arrange
      const fileName = "20251022T143045create_users.ts"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Invalid migration filename")
      }
    })

    test("should reject filename with uppercase description", () => {
      // Arrange
      const fileName = "20251022T143045_Create_Users.ts"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Invalid migration filename")
      }
    })

    test("should reject filename with special characters in description", () => {
      // Arrange
      const fileName = "20251022T143045_create-users.ts"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Invalid migration filename")
      }
    })

    test("should reject invalid month (13)", () => {
      // Arrange
      const fileName = "20251322T143045_invalid_month.ts"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Invalid month")
      }
    })

    test("should reject invalid month (00)", () => {
      // Arrange
      const fileName = "20250022T143045_invalid_month.ts"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Invalid month")
      }
    })

    test("should reject invalid day for month (Feb 30)", () => {
      // Arrange
      const fileName = "20250230T143045_invalid_day.ts"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Invalid day")
      }
    })

    test("should reject invalid day (32)", () => {
      // Arrange
      const fileName = "20251032T143045_invalid_day.ts"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Invalid day")
      }
    })

    test("should reject invalid day (00)", () => {
      // Arrange
      const fileName = "20251000T143045_invalid_day.ts"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Invalid day")
      }
    })

    test("should reject invalid hour (25)", () => {
      // Arrange
      const fileName = "20251022T253045_invalid_hour.ts"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Invalid hour")
      }
    })

    test("should reject invalid minute (60)", () => {
      // Arrange
      const fileName = "20251022T146045_invalid_minute.ts"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Invalid minute")
      }
    })

    test("should reject invalid second (60)", () => {
      // Arrange
      const fileName = "20251022T143060_invalid_second.ts"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Invalid second")
      }
    })

    test("should reject timestamp without T separator", () => {
      // Arrange
      const fileName = "20251022143045_no_separator.ts"
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Invalid migration filename")
      }
    })

    test("should reject empty filename", () => {
      // Arrange
      const fileName = ""
      const dirPath = "./migrations"

      // Act
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      expect(result.isError).toBe(true)
    })
  })

  describe("equals", () => {
    test("should return true for identical versions and filenames", () => {
      // Arrange
      const fileName = "20251022T143045_create_users.ts"
      const dirPath = "./migrations"
      const result1 = MigrationFileInfo.fromFileName(fileName, dirPath)
      const result2 = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      if (!result1.isError && !result2.isError) {
        expect(result1.value.equals(result2.value)).toBe(true)
      }
    })

    test("should return false for different versions", () => {
      // Arrange
      const file1Result = MigrationFileInfo.fromFileName("20251022T143045_create_users.ts", "./migrations")
      const file2Result = MigrationFileInfo.fromFileName("20251022T143046_create_users.ts", "./migrations")

      // Assert
      if (!file1Result.isError && !file2Result.isError) {
        expect(file1Result.value.equals(file2Result.value)).toBe(false)
      }
    })

    test("should return false for different descriptions", () => {
      // Arrange
      const file1Result = MigrationFileInfo.fromFileName("20251022T143045_create_users.ts", "./migrations")
      const file2Result = MigrationFileInfo.fromFileName("20251022T143045_add_posts.ts", "./migrations")

      // Assert
      if (!file1Result.isError && !file2Result.isError) {
        expect(file1Result.value.equals(file2Result.value)).toBe(false)
      }
    })
  })

  describe("toString", () => {
    test("should format string representation correctly", () => {
      // Arrange
      const fileName = "20251022T143045_create_users.ts"
      const dirPath = "./migrations"
      const result = MigrationFileInfo.fromFileName(fileName, dirPath)

      // Assert
      if (!result.isError) {
        const str = result.value.toString()
        expect(str).toContain("20251022T143045")
        expect(str).toContain("create_users")
        expect(str).toContain(fileName)
      }
    })
  })
})
