/**
 * Collision test: First file with same timestamp
 */

import type { DatabaseConnection } from "../../../../src/types.ts"

export function up(db: DatabaseConnection): void {
  db.exec("CREATE TABLE test1 (id TEXT PRIMARY KEY)")
}
