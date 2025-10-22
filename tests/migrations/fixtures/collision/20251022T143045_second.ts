/**
 * Collision test: Second file with same timestamp
 */

import type { DatabaseConnection } from "../../../../src/types.ts"

export function up(db: DatabaseConnection): void {
  db.exec("CREATE TABLE test2 (id TEXT PRIMARY KEY)")
}
