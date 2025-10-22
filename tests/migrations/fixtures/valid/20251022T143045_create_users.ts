/**
 * Valid migration: Create users table
 */

import type { DatabaseConnection } from "../../../../src/types.ts"

export async function up(db: DatabaseConnection): Promise<void> {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL
    )
  `)
}

export async function down(db: DatabaseConnection): Promise<void> {
  db.exec("DROP TABLE IF EXISTS users")
}
