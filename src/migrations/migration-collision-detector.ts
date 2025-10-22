/**
 * Migration collision detector
 * Detects duplicate timestamps in migration files (collision detection)
 */

import type { MigrationFileInfo } from "./migration-file-info.ts"
import type { Result } from "../types.ts"

/**
 * Detects and reports migration file collisions (same timestamp, different files)
 */
// biome-ignore lint: Static class pattern for collision detection
export class MigrationCollisionDetector {
  /**
   * Detect migration version collisions in the provided files
   *
   * A collision occurs when two or more migration files have the same version (timestamp).
   * This is not allowed as migrations must be uniquely identifiable by timestamp.
   *
   * @param files Array of migration file info objects to check for collisions
   * @returns Result with void on success, or descriptive error message with file paths
   *
   * @example
   * const files = [
   *   MigrationFileInfo.fromFileName("20251022T143045_create_users.ts", "./migrations"),
   *   MigrationFileInfo.fromFileName("20251022T143045_add_posts.ts", "./migrations")
   * ]
   * const result = MigrationCollisionDetector.detect(files)
   * if (result.isError) {
   *   console.error(result.error)
   *   // Migration version collision detected: 20251022T143045
   *   // ...
   * }
   */
  static detect(files: MigrationFileInfo[]): Result<void> {
    // Build map of version -> files
    const versionMap = new Map<string, MigrationFileInfo[]>()

    for (const file of files) {
      const version = file.getVersion()
      const existing = versionMap.get(version) ?? []
      existing.push(file)
      versionMap.set(version, existing)
    }

    // Find collisions (versions with more than one file)
    const collisions: [string, MigrationFileInfo[]][] = Array.from(versionMap.entries()).filter(
      ([_, filesWithVersion]) => filesWithVersion.length > 1
    )

    if (collisions.length === 0) {
      return { isError: false, value: undefined }
    }

    // Format error message with all collisions and conflicting files
    const collisionMessages = collisions
      .map(([version, filesWithVersion]) => {
        const fileList = filesWithVersion.map(file => `  - ${file.getFilePath()}`).join("\n")
        return `Migration version collision detected: ${version}\n\nConflicting files:\n${fileList}`
      })
      .join("\n\n")

    return {
      isError: true,
      error: collisionMessages,
    }
  }
}
