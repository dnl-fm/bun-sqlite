/**
 * Invalid migration: No timestamp in filename
 * This file should be skipped by the loader
 */

import type { DatabaseConnection } from "../../../../src/types.ts"

export function up(db: DatabaseConnection): void {
  db.exec("CREATE TABLE users (id TEXT PRIMARY KEY)")
}
