/**
 * Invalid migration: Missing up function
 * This should cause validation to fail
 */

import type { DatabaseConnection } from "../../../../src/types.ts"

export function down(db: DatabaseConnection): void {
  db.exec("DROP TABLE users")
}
