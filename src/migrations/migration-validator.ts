/**
 * Migration module validator
 * Ensures migration modules have required up/down functions with correct signatures
 */

import type { MigrationModule } from "./migration-runner.ts"
import type { Result } from "../types.ts"

/**
 * Validates that a loaded migration module has the required structure and functions
 */
// biome-ignore lint: Static class pattern for module validation
export class MigrationValidator {
  /**
   * Validate a migration module has required up and optional down functions
   *
   * @param module Unknown module to validate (typically from dynamic import)
   * @returns Result with MigrationModule or descriptive error message
   *
   * @example
   * const module = await import("./20251022T143045_create_users.ts")
   * const result = MigrationValidator.validate(module)
   * if (!result.isError) {
   *   const migration = result.value
   * }
   */
  static validate(module: unknown): Result<MigrationModule> {
    // Check module exists
    if (!module || typeof module !== "object") {
      return {
        isError: true,
        error: "Migration module must be a valid JavaScript object",
      }
    }

    const mod = module as Record<string, unknown>

    // Check for required 'up' function
    if (!("up" in mod)) {
      return {
        isError: true,
        error: "Migration module must export an 'up' function",
      }
    }

    if (typeof mod.up !== "function") {
      return {
        isError: true,
        error: `Migration 'up' must be a function, got: ${typeof mod.up}`,
      }
    }

    // Check 'down' function if present
    if ("down" in mod && mod.down !== undefined && mod.down !== null) {
      if (typeof mod.down !== "function") {
        return {
          isError: true,
          error: `Migration 'down' must be a function, got: ${typeof mod.down}`,
        }
      }
    }

    // Return validated migration module
    const migration: MigrationModule = {
      up: mod.up as (db: any) => void | Promise<void>,
    }

    // Only add down if it's a function
    if (mod.down && typeof mod.down === "function") {
      migration.down = mod.down as (db: any) => void | Promise<void>
    }

    return { isError: false, value: migration }
  }
}
