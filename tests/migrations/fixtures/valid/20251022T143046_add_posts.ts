/**
 * Valid migration: Add posts table
 */

import type { DatabaseConnection } from "../../../../src/types.ts"

export function up(db: DatabaseConnection): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)
}

export function down(db: DatabaseConnection): void {
  db.exec("DROP TABLE IF EXISTS posts")
}
