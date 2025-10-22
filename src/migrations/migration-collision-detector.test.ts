/**
 * Tests for MigrationCollisionDetector
 */

import { test, expect, describe } from "bun:test"
import { MigrationCollisionDetector } from "./migration-collision-detector.ts"
import { MigrationFileInfo } from "./migration-file-info.ts"

describe("MigrationCollisionDetector", () => {
  describe("detect - No collisions", () => {
    test("should pass with empty array", () => {
      // Arrange
      const files: MigrationFileInfo[] = []

      // Act
      const result = MigrationCollisionDetector.detect(files)

      // Assert
      expect(result.isError).toBe(false)
    })

    test("should pass with single file", () => {
      // Arrange
      const file1Result = MigrationFileInfo.fromFileName("20251022T143045_create_users.ts", "./migrations")
      const files = file1Result.isError ? [] : [file1Result.value]

      // Act
      const result = MigrationCollisionDetector.detect(files)

      // Assert
      expect(result.isError).toBe(false)
    })

    test("should pass with multiple files with different timestamps", () => {
      // Arrange
      const file1Result = MigrationFileInfo.fromFileName("20251022T143045_create_users.ts", "./migrations")
      const file2Result = MigrationFileInfo.fromFileName("20251022T143046_add_posts.ts", "./migrations")
      const file3Result = MigrationFileInfo.fromFileName("20251022T143047_add_comments.ts", "./migrations")

      const files = [
        ...(file1Result.isError ? [] : [file1Result.value]),
        ...(file2Result.isError ? [] : [file2Result.value]),
        ...(file3Result.isError ? [] : [file3Result.value]),
      ]

      // Act
      const result = MigrationCollisionDetector.detect(files)

      // Assert
      expect(result.isError).toBe(false)
    })

    test("should pass with files from different years", () => {
      // Arrange
      const file1Result = MigrationFileInfo.fromFileName("20241022T143045_create_users.ts", "./migrations")
      const file2Result = MigrationFileInfo.fromFileName("20251022T143045_add_posts.ts", "./migrations")

      const files = [
        ...(file1Result.isError ? [] : [file1Result.value]),
        ...(file2Result.isError ? [] : [file2Result.value]),
      ]

      // Act
      const result = MigrationCollisionDetector.detect(files)

      // Assert
      expect(result.isError).toBe(false)
    })
  })

  describe("detect - Single collision", () => {
    test("should detect two files with same timestamp", () => {
      // Arrange
      const file1Result = MigrationFileInfo.fromFileName("20251022T143045_create_users.ts", "./migrations")
      const file2Result = MigrationFileInfo.fromFileName("20251022T143045_add_posts.ts", "./migrations")

      const files = [
        ...(file1Result.isError ? [] : [file1Result.value]),
        ...(file2Result.isError ? [] : [file2Result.value]),
      ]

      // Act
      const result = MigrationCollisionDetector.detect(files)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("Migration version collision detected: 20251022T143045")
        expect(result.error).toContain("20251022T143045_create_users.ts")
        expect(result.error).toContain("20251022T143045_add_posts.ts")
        expect(result.error).toContain("Conflicting files:")
      }
    })

    test("should include full file paths in error message", () => {
      // Arrange
      const file1Result = MigrationFileInfo.fromFileName("20251022T143045_test.ts", "/home/user/project/migrations")
      const file2Result = MigrationFileInfo.fromFileName("20251022T143045_test2.ts", "/home/user/project/migrations")

      const files = [
        ...(file1Result.isError ? [] : [file1Result.value]),
        ...(file2Result.isError ? [] : [file2Result.value]),
      ]

      // Act
      const result = MigrationCollisionDetector.detect(files)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("/home/user/project/migrations/20251022T143045_test.ts")
        expect(result.error).toContain("/home/user/project/migrations/20251022T143045_test2.ts")
      }
    })

    test("should detect three files with same timestamp", () => {
      // Arrange
      const file1Result = MigrationFileInfo.fromFileName("20251022T143045_first.ts", "./migrations")
      const file2Result = MigrationFileInfo.fromFileName("20251022T143045_second.ts", "./migrations")
      const file3Result = MigrationFileInfo.fromFileName("20251022T143045_third.ts", "./migrations")

      const files = [
        ...(file1Result.isError ? [] : [file1Result.value]),
        ...(file2Result.isError ? [] : [file2Result.value]),
        ...(file3Result.isError ? [] : [file3Result.value]),
      ]

      // Act
      const result = MigrationCollisionDetector.detect(files)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        expect(result.error).toContain("20251022T143045_first.ts")
        expect(result.error).toContain("20251022T143045_second.ts")
        expect(result.error).toContain("20251022T143045_third.ts")
      }
    })
  })

  describe("detect - Multiple collisions", () => {
    test("should detect multiple collision groups", () => {
      // Arrange
      const file1Result = MigrationFileInfo.fromFileName("20251022T143045_a.ts", "./migrations")
      const file2Result = MigrationFileInfo.fromFileName("20251022T143045_b.ts", "./migrations")
      const file3Result = MigrationFileInfo.fromFileName("20251022T143046_c.ts", "./migrations")
      const file4Result = MigrationFileInfo.fromFileName("20251022T143046_d.ts", "./migrations")

      const files = [
        ...(file1Result.isError ? [] : [file1Result.value]),
        ...(file2Result.isError ? [] : [file2Result.value]),
        ...(file3Result.isError ? [] : [file3Result.value]),
        ...(file4Result.isError ? [] : [file4Result.value]),
      ]

      // Act
      const result = MigrationCollisionDetector.detect(files)

      // Assert
      expect(result.isError).toBe(true)
      if (result.isError) {
        // Should contain both collision versions
        expect(result.error).toContain("20251022T143045")
        expect(result.error).toContain("20251022T143046")
        // And all conflicting files
        expect(result.error).toContain("_a.ts")
        expect(result.error).toContain("_b.ts")
        expect(result.error).toContain("_c.ts")
        expect(result.error).toContain("_d.ts")
      }
    })
  })

  describe("detect - Edge cases", () => {
    test("should handle files with same description but different timestamps", () => {
      // Arrange
      const file1Result = MigrationFileInfo.fromFileName("20251022T143045_create_users.ts", "./migrations")
      const file2Result = MigrationFileInfo.fromFileName("20251022T143046_create_users.ts", "./migrations")

      const files = [
        ...(file1Result.isError ? [] : [file1Result.value]),
        ...(file2Result.isError ? [] : [file2Result.value]),
      ]

      // Act
      const result = MigrationCollisionDetector.detect(files)

      // Assert
      expect(result.isError).toBe(false)
    })
  })
})
