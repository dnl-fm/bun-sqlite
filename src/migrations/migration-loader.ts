/**
 * Migration loader
 * Discovers, validates, and loads migration modules from a directory
 */

import { readdirSync } from "node:fs"
import { resolve } from "node:path"
import { MigrationFileInfo } from "./migration-file-info.ts"
import { MigrationValidator } from "./migration-validator.ts"
import { MigrationCollisionDetector } from "./migration-collision-detector.ts"
import type { MigrationModule } from "./migration-runner.ts"
import type { Result } from "../types.ts"

/**
 * Loads and validates migration modules from a directory
 *
 * Responsibilities:
 * - Scan directory for migration files matching pattern
 * - Parse and validate filenames
 * - Detect collisions (duplicate timestamps)
 * - Dynamically import modules
 * - Validate module structure
 * - Sort by version (timestamp) ascending
 */
// biome-ignore lint: Static class pattern for migration loading
export class MigrationLoader {
  /**
   * Load all migrations from a directory
   *
   * Scans the directory for TypeScript files matching the migration pattern
   * (YYYYMMDDTHHMMSS_description.ts), validates them, and returns a record
   * mapping version strings to migration modules.
   *
   * Migrations are sorted by version (timestamp) in ascending order.
   *
   * @param dirPath Path to directory containing migration files
   * @returns Result with Record mapping versions to migration modules, or error
   *
   * @example
   * const result = await MigrationLoader.load("./migrations")
   * if (!result.isError) {
   *   const migrations = result.value
   *   console.log(Object.keys(migrations)) // ["20251022T143045", "20251022T143046"]
   * }
   */
  static async load(dirPath: string): Promise<Result<Record<string, MigrationModule>>> {
    try {
      // Read directory
      const files = readdirSync(dirPath)

      // Filter and parse migration files
      const migrationFiles: MigrationFileInfo[] = []
      const parseErrors: string[] = []

      for (const fileName of files) {
        // Only process .ts files
        if (!fileName.endsWith(".ts")) {
          continue
        }

        // Try to parse as migration file
        const parseResult = MigrationFileInfo.fromFileName(fileName, dirPath)

        if (parseResult.isError) {
          parseErrors.push(`${fileName}: ${parseResult.error}`)
          continue
        }

        migrationFiles.push(parseResult.value)
      }

      // Check for collisions before proceeding
      const collisionResult = MigrationCollisionDetector.detect(migrationFiles)
      if (collisionResult.isError) {
        return collisionResult
      }

      // Sort by version (timestamp) ascending - older migrations first
      migrationFiles.sort((a, b) => a.getVersion().localeCompare(b.getVersion()))

      // Load and validate each migration
      const migrations: Record<string, MigrationModule> = {}

      for (const fileInfo of migrationFiles) {
        const version = fileInfo.getVersion()
        const filePath = fileInfo.getFilePath()

        try {
          // Dynamically import the module (use absolute path)
          // Note: JSR warning about dynamic import is intentional - migration files are loaded
          // at runtime based on directory scanning, not known at publish time
          const absolutePath = resolve(filePath)
          // deno-lint-ignore no-dynamic-import
          const module = await import(absolutePath)

          // Validate the module structure
          const validationResult = MigrationValidator.validate(module)

          if (validationResult.isError) {
            return {
              isError: true,
              error: `Invalid migration module ${filePath}: ${validationResult.error}`,
            }
          }

          migrations[version] = validationResult.value
        } catch (importError) {
          return {
            isError: true,
            error: `Failed to load migration ${filePath}: ${importError}`,
          }
        }
      }

      return { isError: false, value: migrations }
    } catch (error) {
      return {
        isError: true,
        error: `Failed to load migrations from ${dirPath}: ${error}`,
      }
    }
  }
}

/**
 * Convenience function to load migrations
 * @param dirPath Path to directory containing migration files
 * @returns Result with Record mapping versions to migration modules, or error
 *
 * @example
 * const result = await loadMigrations("./migrations")
 */
export async function loadMigrations(dirPath: string): Promise<Result<Record<string, MigrationModule>>> {
  return MigrationLoader.load(dirPath)
}
